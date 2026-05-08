// decision-mechanism.ts
// Generic processor for the decision-mechanism queue. Job name is the
// MechanismKind. Each job:
//   1. Marks its mechanism_run row 'running'
//   2. Calls the mechanism LLM prompt
//   3. Persists raw_output (findings + transcript) and marks 'completed'
//   4. Schedules a debounced synth-tick on the orchestrator queue
//
// Failure path:
//   - On throw, BullMQ retries (queue defaults). On final failure, the
//     mechanism_run is marked 'failed' with error_message; orchestrator
//     treats this as a terminal state and continues.

import type { Job } from "bullmq";
import { supabase } from "../supabase.js";
import { decisionOrchestratorQueue } from "../queue.js";
import { buildLLM, type LLMOverrides } from "../llm/factory.js";
import { robustJsonParse } from "../utils/json-parse.js";
import {
  MAX_FINDINGS_PER_MECHANISM,
  SYNTHESIZER_DEBOUNCE_MS,
  type DecisionBrief,
  type MechanismFindingDraft,
  type MechanismKind,
  type MechanismOutput,
} from "../types/decision.js";
import type { Persona } from "../types/persona.js";
import { buildMechanismPrompt } from "../prompts/mechanism-prompts.js";
import { log } from "../utils/logger.js";
import type { BriefWebEvidence } from "../lib/pre-search.js";

export interface DecisionMechanismJobData {
  briefId: string;
  runId: string;
  kind: MechanismKind;
  llmOverrides?: LLMOverrides;
}

export async function processDecisionMechanismJob(
  job: Job<DecisionMechanismJobData>,
): Promise<void> {
  const { briefId, runId, kind, llmOverrides } = job.data;
  const ctx = { briefId, runId, kind, jobId: job.id };
  log.info("decision_mechanism.start", ctx);

  // Mark running. The status guard prevents a stale BullMQ retry from
  // resurrecting a row that was previously marked 'completed' by a
  // concurrent attempt — under retry-on-failure we may legitimately see
  // 'failed' (set by the prior attempt's catch) or 'queued' (initial
  // dispatch); both should transition cleanly to 'running'. A 'completed'
  // row stays put.
  await supabase
    .from("decision_mechanism_runs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      attempts: (job.attemptsMade ?? 0) + 1,
    })
    .eq("id", runId)
    .in("status", ["queued", "failed", "running"]);

  const startMs = Date.now();

  try {
    const brief = await fetchBrief(briefId);
    if (!brief) throw new Error(`brief ${briefId} not found`);
    const personas = await fetchPersonasByIds(brief.persona_ids);

    const args = brief.mechanisms.find((m) => m.kind === kind)?.args ?? {};

    // Web evidence is per-brief and shared across mechanisms. We pass it
    // only to mechanisms that benefit from external data — theory of
    // mind and reflection ranker are reasoning-about-reasoning and use
    // empty evidence so the prompt stays tight.
    const wantsWebEvidence =
      kind === "persona_review" ||
      kind === "round_table_debate" ||
      kind === "scenario_simulation" ||
      kind === "cross_challenge";
    const webEvidence = wantsWebEvidence
      ? ((brief as unknown as { web_evidence?: BriefWebEvidence | null }).web_evidence ?? null)
      : null;

    const { system, prompt } = buildMechanismPrompt(kind, {
      question: brief.canonical_question,
      routing: brief.routing_extract,
      personas,
      time_horizon_months: args.time_horizon_months,
      stakeholder_to_simulate: args.stakeholder_to_simulate,
      debate_rounds: args.debate_rounds,
      web_evidence: webEvidence,
    });

    const llm = buildLLM(llmOverrides);
    const response = await llm.complete({
      system,
      prompt,
      // Bumped from 4096 → 6144: the structured mechanism_view (stance
      // matrices for up to 25 personas, scenario blocks, evidence arrays)
      // can push past 4096 on wider panels.
      maxTokens: 6144,
      jsonMode: true,
    });

    const parsed = robustJsonParse<{
      findings: MechanismFindingDraft[];
      mechanism_view?: MechanismOutput["mechanism_view"];
      raw_transcript: unknown;
    }>(response.text);

    const sanitized = sanitizeFindings(parsed.findings, brief.persona_ids);
    const sanitizedView = sanitizeMechanismView(
      kind,
      parsed.mechanism_view,
      brief.persona_ids,
    );

    const rawOutput: MechanismOutput = {
      findings: sanitized,
      mechanism_view: sanitizedView ?? undefined,
      raw_transcript: parsed.raw_transcript ?? "",
    };

    const durationMs = Date.now() - startMs;
    await supabase
      .from("decision_mechanism_runs")
      .update({
        status: "completed",
        raw_output: rawOutput,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
      })
      .eq("id", runId);

    log.info("decision_mechanism.complete", {
      ...ctx,
      findingCount: sanitized.length,
      durationMs,
    });

    // Schedule a debounced synthesizer tick. Same briefId + same jobId
    // collapses concurrent ticks into one within the debounce window.
    await decisionOrchestratorQueue.add(
      "synth-tick",
      { briefId },
      {
        jobId: `synth-${briefId}`,
        delay: SYNTHESIZER_DEBOUNCE_MS,
        removeOnComplete: true,
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn("decision_mechanism.failed_attempt", { ...ctx, error: message });

    // BullMQ retries on throw. We only mark the row 'failed' (a TERMINAL
    // status that allTerminal counts toward brief completion) on the
    // FINAL attempt — earlier attempts leave the row as 'running' so a
    // peer-mechanism's success-tick can't see this row as terminal and
    // finalize the brief while a retry is still in flight, producing a
    // "completed" artifact that misses the eventually-succeeding mechanism.
    // On retry, the top-of-handler UPDATE flips status back to 'running'.
    const totalAttempts = job.opts.attempts ?? 1;
    const isFinalAttempt = (job.attemptsMade ?? 0) + 1 >= totalAttempts;
    if (isFinalAttempt) {
      await supabase
        .from("decision_mechanism_runs")
        .update({
          status: "failed",
          error_message: message.slice(0, 1000),
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startMs,
        })
        .eq("id", runId);

      await decisionOrchestratorQueue.add(
        "synth-tick",
        { briefId },
        {
          jobId: `synth-${briefId}`,
          delay: SYNTHESIZER_DEBOUNCE_MS,
          removeOnComplete: true,
        },
      );
    } else {
      // Non-final attempt: capture error context but leave the row in
      // a non-terminal state so peer ticks don't finalize prematurely.
      await supabase
        .from("decision_mechanism_runs")
        .update({
          error_message: message.slice(0, 1000),
        })
        .eq("id", runId);
    }

    throw err;
  }
}

async function fetchBrief(briefId: string): Promise<DecisionBrief | null> {
  const { data, error } = await supabase
    .from("decision_briefs")
    .select("*")
    .eq("id", briefId)
    .maybeSingle();
  if (error) throw new Error(`brief fetch failed: ${error.message}`);
  return data as DecisionBrief | null;
}

async function fetchPersonasByIds(ids: string[]): Promise<Persona[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("personas")
    .select("*")
    .in("id", ids);
  if (error) throw new Error(`personas fetch failed: ${error.message}`);
  return (data ?? []) as Persona[];
}

function sanitizeFindings(
  raw: unknown,
  validPersonaIds: string[],
): MechanismFindingDraft[] {
  if (!Array.isArray(raw)) return [];
  const validSet = new Set(validPersonaIds);
  return raw
    .slice(0, MAX_FINDINGS_PER_MECHANISM)
    .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
    .map((f) => {
      const headline = typeof f.headline === "string" ? f.headline.slice(0, 200) : "";
      if (!headline) return null;
      const sev = typeof f.severity === "number" ? Math.round(f.severity) : 3;
      const severity = (Math.max(1, Math.min(5, sev))) as 1 | 2 | 3 | 4 | 5;
      const conf = typeof f.confidence === "number" ? f.confidence : 0.5;
      const confidence = Math.max(0, Math.min(1, conf));
      const detail =
        typeof f.detail_summary === "string"
          ? f.detail_summary.slice(0, 600)
          : "";
      const cited = Array.isArray(f.cited_persona_ids)
        ? (f.cited_persona_ids as unknown[])
            .filter((x): x is string => typeof x === "string")
            .filter((id) => validSet.has(id))
        : [];
      const evidence = sanitizeEvidence(f.evidence);
      return {
        headline,
        severity,
        confidence,
        detail_summary: detail,
        cited_persona_ids: cited,
        ...(evidence.length > 0 ? { evidence } : {}),
      };
    })
    .filter((f): f is MechanismFindingDraft => f !== null);
}

const VALID_EVIDENCE_KINDS = new Set([
  "data_point",
  "comparable",
  "user_research",
  "principle",
  "expert_view",
]);

function sanitizeEvidence(raw: unknown): NonNullable<MechanismFindingDraft["evidence"]> {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 6) // cap per finding to keep cards visually manageable
    .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
    .map((e) => {
      const kindRaw = typeof e.kind === "string" ? e.kind : "principle";
      const kind = (
        VALID_EVIDENCE_KINDS.has(kindRaw) ? kindRaw : "principle"
      ) as NonNullable<MechanismFindingDraft["evidence"]>[number]["kind"];
      const text = typeof e.text === "string" ? e.text.slice(0, 240) : "";
      if (!text) return null;
      const sourceRaw = typeof e.source === "string" ? e.source.slice(0, 500) : "";
      return { kind, text, ...(sourceRaw ? { source: sourceRaw } : {}) };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);
}

// Validates the mechanism_view payload from the LLM. Drops fields with
// the wrong shape, filters persona_ids to ones actually in the brief,
// caps array sizes. If the result no longer matches the schema for the
// running mechanism, returns null and the UI falls back to the findings
// list alone (no broken render).
function sanitizeMechanismView(
  expectedKind: MechanismKind,
  raw: unknown,
  validPersonaIds: string[],
): MechanismOutput["mechanism_view"] | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const kind = typeof v.kind === "string" ? v.kind : null;
  if (kind !== expectedKind) return null;
  const validSet = new Set(validPersonaIds);

  const STANCE = new Set(["supports", "neutral", "opposes"]);
  const IMPACT = new Set(["low", "medium", "high", "critical"]);

  const pickStr = (x: unknown, max: number) =>
    typeof x === "string" ? x.slice(0, max) : "";

  if (kind === "persona_review") {
    const takesRaw = Array.isArray(v.persona_takes) ? v.persona_takes : [];
    const persona_takes = takesRaw
      .slice(0, 25)
      .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
      .map((t) => {
        const persona_id = typeof t.persona_id === "string" ? t.persona_id : "";
        if (!validSet.has(persona_id)) return null;
        const stanceRaw = typeof t.stance === "string" ? t.stance : "neutral";
        const stance = (STANCE.has(stanceRaw) ? stanceRaw : "neutral") as
          "supports" | "neutral" | "opposes";
        const key_insight = pickStr(t.key_insight, 200);
        if (!key_insight) return null;
        const surprising_angle = pickStr(t.surprising_angle, 200);
        return {
          persona_id,
          stance,
          key_insight,
          ...(surprising_angle ? { surprising_angle } : {}),
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
    if (persona_takes.length === 0) return null;
    return { kind: "persona_review", persona_takes };
  }

  if (kind === "round_table_debate") {
    const matrixRaw = Array.isArray(v.stance_matrix) ? v.stance_matrix : [];
    const stance_matrix = matrixRaw
      .slice(0, 25)
      .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
      .map((r) => {
        const persona_id = typeof r.persona_id === "string" ? r.persona_id : "";
        if (!validSet.has(persona_id)) return null;
        const opening = typeof r.opening_stance === "string" ? r.opening_stance : "neutral";
        const opening_stance = (STANCE.has(opening) ? opening : "neutral") as
          "supports" | "neutral" | "opposes";
        const final = typeof r.final_stance === "string" ? r.final_stance : "neutral";
        const final_stance = (STANCE.has(final) ? final : "neutral") as
          "supports" | "neutral" | "opposes";
        const key_argument = pickStr(r.key_argument, 200);
        if (!key_argument) return null;
        return {
          persona_id,
          opening_stance,
          final_stance,
          shifted: opening_stance !== final_stance,
          key_argument,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const exchangesRaw = Array.isArray(v.pivotal_exchanges) ? v.pivotal_exchanges : [];
    const pivotal_exchanges = exchangesRaw
      .slice(0, 6)
      .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
      .map((e) => {
        const from_persona_id =
          typeof e.from_persona_id === "string" ? e.from_persona_id : "";
        const to_persona_id =
          typeof e.to_persona_id === "string" ? e.to_persona_id : "";
        if (!validSet.has(from_persona_id) || !validSet.has(to_persona_id)) {
          return null;
        }
        const summary = pickStr(e.summary, 240);
        if (!summary) return null;
        return { from_persona_id, to_persona_id, summary };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    if (stance_matrix.length === 0) return null;
    return { kind: "round_table_debate", stance_matrix, pivotal_exchanges };
  }

  if (kind === "scenario_simulation") {
    const scRaw = Array.isArray(v.scenarios) ? v.scenarios : [];
    const scenarios = scRaw
      .slice(0, 4)
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
      .map((s) => {
        const name = pickStr(s.name, 60);
        if (!name) return null;
        const probRaw = typeof s.probability_pct === "number" ? s.probability_pct : 0;
        const probability_pct = Math.max(0, Math.min(100, Math.round(probRaw)));
        const impactRaw = typeof s.impact === "string" ? s.impact : "medium";
        const impact = (IMPACT.has(impactRaw) ? impactRaw : "medium") as
          "low" | "medium" | "high" | "critical";
        const narrative = pickStr(s.narrative, 240);
        if (!narrative) return null;
        const indRaw = Array.isArray(s.leading_indicators) ? s.leading_indicators : [];
        const leading_indicators = indRaw
          .slice(0, 5)
          .map((i) => pickStr(i, 100))
          .filter((i) => i.length > 0);
        return { name, probability_pct, impact, narrative, leading_indicators };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
    if (scenarios.length === 0) return null;
    return { kind: "scenario_simulation", scenarios };
  }

  if (kind === "theory_of_mind") {
    const stakeholder = pickStr(v.stakeholder, 80);
    const optimize = Array.isArray(v.what_they_optimize_for)
      ? v.what_they_optimize_for.slice(0, 6).map((x) => pickStr(x, 120)).filter(Boolean)
      : [];
    const fears = Array.isArray(v.fears)
      ? v.fears.slice(0, 6).map((x) => pickStr(x, 120)).filter(Boolean)
      : [];
    const change = Array.isArray(v.what_would_change_their_mind)
      ? v.what_would_change_their_mind.slice(0, 5).map((x) => pickStr(x, 180)).filter(Boolean)
      : [];
    if (!stakeholder || (optimize.length === 0 && fears.length === 0)) return null;
    return {
      kind: "theory_of_mind",
      stakeholder,
      what_they_optimize_for: optimize,
      fears,
      what_would_change_their_mind: change,
    };
  }

  if (kind === "cross_challenge") {
    const pairsRaw = Array.isArray(v.pairings) ? v.pairings : [];
    const pairings = pairsRaw
      .slice(0, 12)
      .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
      .map((p) => {
        const proponent_id = typeof p.proponent_id === "string" ? p.proponent_id : "";
        const challenger_id = typeof p.challenger_id === "string" ? p.challenger_id : "";
        if (!validSet.has(proponent_id) || !validSet.has(challenger_id)) return null;
        const position = pickStr(p.position, 200);
        const sharpest_counter = pickStr(p.sharpest_counter, 240);
        const residual_uncertainty = pickStr(p.residual_uncertainty, 200);
        if (!position || !sharpest_counter) return null;
        return { proponent_id, challenger_id, position, sharpest_counter, residual_uncertainty };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
    if (pairings.length === 0) return null;
    return { kind: "cross_challenge", pairings };
  }

  if (kind === "reflection_ranker") {
    const scoresRaw = Array.isArray(v.finding_scores) ? v.finding_scores : [];
    const finding_scores = scoresRaw
      .slice(0, 20)
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
      .map((s) => {
        const finding_headline = pickStr(s.finding_headline, 200);
        const evRaw = typeof s.evidence_strength === "number" ? s.evidence_strength : 3;
        const evidence_strength = Math.max(1, Math.min(5, Math.round(evRaw))) as 1 | 2 | 3 | 4 | 5;
        const missing_evidence = pickStr(s.missing_evidence, 200);
        if (!finding_headline) return null;
        return { finding_headline, evidence_strength, missing_evidence };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
    if (finding_scores.length === 0) return null;
    return { kind: "reflection_ranker", finding_scores };
  }

  return null;
}
