// synthesizer.ts
// Spec: docs/superpowers/specs/2026-05-06-multi-agent-decision-tool-design.md §7.2
//
// Composes per-mechanism findings from completed mechanism_runs into the
// decision_findings table. The composition is deterministic — no LLM call —
// because each mechanism processor already emits structured bullets.
//
// On the final pass we additionally run a conflict-detection LLM step
// (reflection_ranker role) that flags places where two mechanisms reached
// contradictory conclusions on the same point. Conflicts surface as
// findings with source_mechanism = "conflict_warning".

import { createHash } from "node:crypto";
import { supabase } from "../supabase.js";
import { buildAuxLLM } from "../llm/factory.js";
import { robustJsonParse } from "../utils/json-parse.js";
import {
  type DecisionBrief,
  type MechanismKind,
  type MechanismOutput,
  type MechanismRun,
} from "../types/decision.js";
import { log } from "../utils/logger.js";

interface SynthesizerInput {
  briefId: string;
  brief: DecisionBrief;
  runs: MechanismRun[];
  finalPass: boolean;
}

const CONFLICT_PROMPT_VERSION = "conflict-detect-v1";
const CONFLICT_SYSTEM = `You read several conclusion-bullets from different analysis mechanisms about the same decision and identify contradictions between them.

Output strict JSON (no prose):

{
  "conflicts": [
    {
      "headline": "<short one-line description of the contradiction>",
      "involves_mechanisms": ["<mechanism_kind>", "<mechanism_kind>", ...],
      "involves_finding_indices": [<int>, <int>, ...],
      "severity": 1..5,
      "confidence": 0..1,
      "detail_summary": "<≤200 chars: what each side says, why they conflict>"
    }
  ]
}

Rules:
- Only flag genuine contradictions. Different angles on the same topic that do not contradict are NOT conflicts.
- Severity reflects how important the conflict is to resolve before deciding.
- Confidence is your confidence that the conflict is real, not a wording artifact.
- Output an empty conflicts array if no genuine conflicts exist.`;

export async function runSynthesizer(input: SynthesizerInput): Promise<void> {
  const { briefId, brief, runs, finalPass } = input;
  const ctx = { briefId, finalPass };

  // Defense-in-depth: re-validate cited_persona_ids against the brief's
  // persona_ids on the synthesizer write path. The mechanism processor
  // already filters at insert time, but a stale or hand-edited mechanism
  // run row (e.g., re-pass after a partial failure) shouldn't be able to
  // smuggle persona ids that aren't part of this brief into findings.
  const validPersonaIds = new Set(brief.persona_ids);

  // Pull per-mechanism bullet drafts out of completed runs.
  const allDrafts: Array<{
    runId: string;
    kind: MechanismKind;
    draftIndex: number;
    headline: string;
    severity: number;
    confidence: number;
    detail_summary: string;
    cited_persona_ids: string[];
  }> = [];

  for (const run of runs) {
    if (run.status !== "completed") continue;
    const output = run.raw_output as MechanismOutput | null;
    if (!output || !Array.isArray(output.findings)) continue;
    output.findings.forEach((f, idx) => {
      const sanitizedCitedIds = Array.isArray(f.cited_persona_ids)
        ? f.cited_persona_ids.filter((id) => validPersonaIds.has(id))
        : [];
      allDrafts.push({
        runId: run.id,
        kind: run.kind,
        draftIndex: idx,
        headline: f.headline,
        severity: f.severity,
        confidence: f.confidence,
        detail_summary: f.detail_summary,
        cited_persona_ids: sanitizedCitedIds,
      });
    });
  }

  // Upsert per-mechanism findings (idempotent via content_hash dedupe index).
  for (const d of allDrafts) {
    const hash = contentHash(briefId, d.kind, d.headline);
    const { error } = await supabase.from("decision_findings").upsert(
      {
        brief_id: briefId,
        mechanism_run_id: d.runId,
        source_mechanism: d.kind,
        headline: d.headline,
        severity: d.severity,
        confidence: d.confidence,
        detail_summary: d.detail_summary,
        cited_persona_ids: d.cited_persona_ids,
        position: d.draftIndex,
        content_hash: hash,
      },
      { onConflict: "mechanism_run_id,content_hash" },
    );
    if (error) {
      log.warn("synthesizer.upsert_failed", { ...ctx, error: error.message });
    }
  }

  // Final pass: run conflict detection if we have ≥2 completed mechanisms
  // and the route includes reflection_ranker.
  if (
    finalPass &&
    allDrafts.length >= 2 &&
    brief.mechanisms.some((m) => m.kind === "reflection_ranker")
  ) {
    await detectAndPersistConflicts(briefId, allDrafts, ctx);
  }
}

async function detectAndPersistConflicts(
  briefId: string,
  drafts: Array<{
    runId: string;
    kind: MechanismKind;
    draftIndex: number;
    headline: string;
    detail_summary: string;
  }>,
  ctx: Record<string, unknown>,
): Promise<void> {
  const numbered = drafts
    .map(
      (d, i) =>
        `[${i}] (${d.kind}) ${d.headline}${d.detail_summary ? ` — ${d.detail_summary}` : ""}`,
    )
    .join("\n");

  let conflicts: Array<{
    headline: string;
    involves_mechanisms: string[];
    involves_finding_indices: number[];
    severity: number;
    confidence: number;
    detail_summary: string;
  }> = [];

  try {
    const llm = buildAuxLLM();
    const response = await llm.complete({
      system: CONFLICT_SYSTEM,
      prompt: `Findings:\n${numbered}\n\nIdentify contradictions.`,
      maxTokens: 1500,
      jsonMode: true,
    });
    const parsed = robustJsonParse<{ conflicts: typeof conflicts }>(response.text);
    conflicts = parsed.conflicts ?? [];
  } catch (err) {
    log.warn("synthesizer.conflict_detect_failed", {
      ...ctx,
      error: err instanceof Error ? err.message : String(err),
    });
    return; // skip conflict block on failure; spec §7.4
  }

  // We need a mechanism_run row for conflict_warning findings to point at.
  // Reuse the reflection_ranker run if present; create a synthetic one
  // otherwise so the FK holds.
  const reflectionRunId = await ensureConflictRun(briefId);

  for (const c of conflicts.slice(0, 6)) {
    const hash = contentHash(briefId, "conflict_warning", c.headline);
    await supabase.from("decision_findings").upsert(
      {
        brief_id: briefId,
        mechanism_run_id: reflectionRunId,
        source_mechanism: "conflict_warning",
        headline: c.headline,
        severity: clampInt(c.severity, 1, 5),
        confidence: clamp01(c.confidence),
        detail_summary: c.detail_summary,
        cited_persona_ids: [],
        position: 0,
        content_hash: hash,
      },
      { onConflict: "mechanism_run_id,content_hash" },
    );
  }

  log.info("synthesizer.conflicts_persisted", { ...ctx, conflictCount: conflicts.length });
  // Mark the synthetic conflict-carrier run completed. Guarded by the
  // synthetic flag so a real reflection_ranker run (none routed today,
  // but the kind is in the enum) is never accidentally closed by the
  // synthesizer.
  await supabase
    .from("decision_mechanism_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", reflectionRunId)
    .filter("args->>synthetic", "eq", "true")
    .neq("status", "completed");
}

// Looks up (or creates) a synthetic reflection_ranker run that exists
// solely to anchor conflict_warning findings (decision_findings.brief_id
// must point at a real mechanism_run row). The synthetic flag in args
// distinguishes this from a real reflection_ranker mechanism run, so a
// future migration could legitimately route reflection_ranker as a real
// stage-2 mechanism without the synthesizer clobbering its raw_output.
//
// Atomic via upsert on the unique (brief_id, kind) index from migration
// 064 — concurrent final-pass synth-ticks (rare but possible) cannot
// produce two carrier rows nor crash trying.
async function ensureConflictRun(briefId: string): Promise<string> {
  // First, look up: if a row already exists, we either reuse the
  // synthetic carrier OR refuse to clobber a real reflection_ranker run.
  const existing = await supabase
    .from("decision_mechanism_runs")
    .select("id, args")
    .eq("brief_id", briefId)
    .eq("kind", "reflection_ranker")
    .maybeSingle();
  if (existing.data) {
    const args = existing.data.args as Record<string, unknown> | null;
    if (args && args.synthetic === true) {
      return existing.data.id as string;
    }
    throw new Error(
      `reflection_ranker run already exists for brief ${briefId} but is not a synthetic carrier — refusing to clobber`,
    );
  }

  // No row yet → upsert. If two ticks race here, the second's INSERT is
  // converted to a no-op SELECT-back-to-existing by the unique index +
  // ignoreDuplicates=false; the .select() returns the winning row.
  const { data, error } = await supabase
    .from("decision_mechanism_runs")
    .upsert(
      {
        brief_id: briefId,
        kind: "reflection_ranker",
        status: "running",
        args: { synthetic: true },
        started_at: new Date().toISOString(),
      },
      { onConflict: "brief_id,kind", ignoreDuplicates: false },
    )
    .select("id, args")
    .single();
  if (error) throw new Error(`reflection_ranker run upsert failed: ${error.message}`);
  // After upsert, verify we own a synthetic row (someone could have
  // raced us to insert a real run between our SELECT and the upsert).
  const args = data.args as Record<string, unknown> | null;
  if (!args || args.synthetic !== true) {
    throw new Error(
      `lost ensureConflictRun race for brief ${briefId} — real reflection_ranker exists`,
    );
  }
  return data.id as string;
}

function contentHash(briefId: string, kind: string, headline: string): string {
  // briefId is in the hash so a retried mechanism run with the same
  // headline doesn't collide across briefs (the dedup index is on
  // mechanism_run_id+content_hash, but two different runs of the same
  // mechanism within one brief would otherwise produce two rows with the
  // same headline — both would get inserted and the artifact would
  // double-show identical bullets).
  return createHash("sha1").update(`${briefId}::${kind}::${headline.trim().toLowerCase()}`).digest("hex");
}

function clamp01(n: unknown): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clampInt(n: unknown, min: number, max: number): 1 | 2 | 3 | 4 | 5 {
  const num = typeof n === "number" && !Number.isNaN(n) ? Math.round(n) : 1;
  const clamped = Math.max(min, Math.min(max, num));
  return clamped as 1 | 2 | 3 | 4 | 5;
}
