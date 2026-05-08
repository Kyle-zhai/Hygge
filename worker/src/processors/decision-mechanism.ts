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

    const { system, prompt } = buildMechanismPrompt(kind, {
      question: brief.canonical_question,
      routing: brief.routing_extract,
      personas,
      time_horizon_months: args.time_horizon_months,
      stakeholder_to_simulate: args.stakeholder_to_simulate,
      debate_rounds: args.debate_rounds,
    });

    const llm = buildLLM(llmOverrides);
    const response = await llm.complete({
      system,
      prompt,
      maxTokens: 4096,
      jsonMode: true,
    });

    const parsed = robustJsonParse<{
      findings: MechanismFindingDraft[];
      raw_transcript: unknown;
    }>(response.text);

    const sanitized = sanitizeFindings(parsed.findings, brief.persona_ids);

    const rawOutput: MechanismOutput = {
      findings: sanitized,
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
        jobId: `synth:${briefId}`,
        delay: SYNTHESIZER_DEBOUNCE_MS,
        removeOnComplete: true,
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn("decision_mechanism.failed_attempt", { ...ctx, error: message });

    // BullMQ retries on throw. On the final attempt, BullMQ calls 'failed'
    // listener; we mark the row failed proactively here so a synth-tick
    // racing the retry sees a terminal state. On a successful retry the
    // status will be flipped back to 'running' at the top of the next run.
    await supabase
      .from("decision_mechanism_runs")
      .update({
        status: "failed",
        error_message: message.slice(0, 1000),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startMs,
      })
      .eq("id", runId);

    // Only kick a synth-tick on the FINAL attempt — otherwise a retry
    // racing the debounced tick can promote 'failed' to terminal,
    // emit the artifact, then have the retry succeed and emit a second
    // artifact. The orchestrator's allTerminal check sees this run as
    // 'failed' which is fine; if a later retry succeeds it will tick on
    // its own success path.
    const totalAttempts = job.opts.attempts ?? 1;
    const isFinalAttempt = (job.attemptsMade ?? 0) + 1 >= totalAttempts;
    if (isFinalAttempt) {
      await decisionOrchestratorQueue.add(
        "synth-tick",
        { briefId },
        {
          jobId: `synth:${briefId}`,
          delay: SYNTHESIZER_DEBOUNCE_MS,
          removeOnComplete: true,
        },
      );
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
      return {
        headline,
        severity,
        confidence,
        detail_summary: detail,
        cited_persona_ids: cited,
      };
    })
    .filter((f): f is MechanismFindingDraft => f !== null);
}
