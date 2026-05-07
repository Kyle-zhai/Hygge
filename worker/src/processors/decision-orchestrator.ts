// decision-orchestrator.ts
// Spec: docs/superpowers/specs/2026-05-06-multi-agent-decision-tool-design.md §7
//
// Two job kinds share this queue:
//   - "orchestrate"  — kicks off after a Brief is finalized; fans out
//                      Stage-1 mechanism jobs and a Stage-2 cross_challenge
//                      job that depends on persona_review.
//   - "synth-tick"   — debounced synthesizer trigger fired by mechanism
//                      jobs whenever they complete. The processor reads the
//                      current set of completed mechanism_runs and either
//                      composes findings (incremental) or emits the final
//                      artifact (when everything is terminal).
//
// Synthesizer composition itself is implemented in synthesizer.ts; this
// processor only handles the scheduling decision tree.

import type { Job } from "bullmq";
import { supabase } from "../supabase.js";
import { decisionMechanismQueue } from "../queue.js";
import {
  ALL_MECHANISMS,
  BRIEF_TOTAL_TIMEOUT_MS,
  type DecisionBrief,
  type MechanismKind,
  type MechanismRun,
} from "../types/decision.js";
import { runSynthesizer } from "./synthesizer.js";
import { log } from "../utils/logger.js";

interface OrchestrateJobData {
  briefId: string;
}
interface SynthTickJobData {
  briefId: string;
}
type DecisionOrchestratorJobData =
  | ({ kind: "orchestrate" } & OrchestrateJobData)
  | ({ kind: "synth-tick" } & SynthTickJobData);

// Job name routing — the dispatcher chooses behavior by job.name rather than
// embedding a discriminator in job.data, matching the rest of the worker.
export async function processDecisionOrchestratorJob(
  job: Job,
): Promise<void> {
  if (job.name === "orchestrate") {
    await orchestrateBrief(job as Job<OrchestrateJobData>);
  } else if (job.name === "synth-tick") {
    await synthesizerTick(job as Job<SynthTickJobData>);
  } else {
    throw new Error(`unknown decision-orchestrator job name: ${job.name}`);
  }
}

// =====================================================================
// orchestrate — fan-out
// =====================================================================
async function orchestrateBrief(job: Job<OrchestrateJobData>) {
  const { briefId } = job.data;
  const ctx = { briefId, jobId: job.id };
  log.info("decision_orchestrator.start", ctx);

  const brief = await fetchBrief(briefId);
  if (!brief) throw new Error(`brief ${briefId} not found`);
  if (brief.status !== "finalized") {
    log.info("decision_orchestrator.noop_status", { ...ctx, status: brief.status });
    return;
  }

  // Idempotency: if mechanism_runs already exist for this brief, the job
  // was retried mid-flight. Don't double-create.
  const existing = await fetchMechanismRuns(briefId);
  const existingKinds = new Set(existing.map((r) => r.kind));
  const stage1: MechanismKind[] = [
    "persona_review",
    "round_table_debate",
    "scenario_simulation",
    "theory_of_mind",
  ];
  const toCreate: MechanismKind[] = brief.mechanisms
    .map((m) => m.kind)
    .filter((k) => stage1.includes(k) && !existingKinds.has(k));

  for (const kind of toCreate) {
    const args = brief.mechanisms.find((m) => m.kind === kind)?.args ?? {};
    const { data: row, error } = await supabase
      .from("decision_mechanism_runs")
      .insert({
        brief_id: briefId,
        kind,
        status: "queued",
        args,
      })
      .select("id")
      .single();
    if (error) throw new Error(`mechanism_run insert failed: ${error.message}`);

    await decisionMechanismQueue.add(
      kind,
      { briefId, runId: row.id, kind },
      { jobId: `mech:${row.id}` },
    );
  }

  log.info("decision_orchestrator.stage1_dispatched", {
    ...ctx,
    dispatched: toCreate,
  });
}

// =====================================================================
// synth-tick — fired after each mechanism completes
// =====================================================================
async function synthesizerTick(job: Job<SynthTickJobData>) {
  const { briefId } = job.data;
  const ctx = { briefId, jobId: job.id };
  const brief = await fetchBrief(briefId);
  if (!brief) {
    log.warn("decision_orchestrator.synth_tick_brief_missing", ctx);
    return;
  }

  if (brief.status === "completed" || brief.status === "failed") {
    log.info("decision_orchestrator.synth_tick_terminal", { ...ctx, status: brief.status });
    return;
  }

  const runs = await fetchMechanismRuns(briefId);

  // Stage-2 dispatch: persona_review just finished, kick off cross_challenge.
  const personaReview = runs.find((r) => r.kind === "persona_review");
  if (
    personaReview?.status === "completed" &&
    brief.mechanisms.some((m) => m.kind === "cross_challenge") &&
    !runs.some((r) => r.kind === "cross_challenge")
  ) {
    const args = brief.mechanisms.find((m) => m.kind === "cross_challenge")?.args ?? {};
    const { data: row, error } = await supabase
      .from("decision_mechanism_runs")
      .insert({
        brief_id: briefId,
        kind: "cross_challenge",
        status: "queued",
        args,
      })
      .select("id")
      .single();
    if (!error && row) {
      await decisionMechanismQueue.add(
        "cross_challenge",
        { briefId, runId: row.id, kind: "cross_challenge" },
        { jobId: `mech:${row.id}` },
      );
      log.info("decision_orchestrator.stage2_dispatched", { ...ctx, runId: row.id });
    }
  }

  const allDispatched = brief.mechanisms.every((m) =>
    runs.some((r) => r.kind === m.kind),
  );
  const allTerminal = runs.every(
    (r) => r.status === "completed" || r.status === "failed" || r.status === "skipped",
  );
  const failedCount = runs.filter((r) => r.status === "failed").length;
  const total = brief.mechanisms.length;
  const ageMs = Date.now() - new Date(brief.finalized_at ?? brief.created_at).getTime();
  const exceededTotalTimeout = ageMs > BRIEF_TOTAL_TIMEOUT_MS;

  // Run incremental synthesis (cheap — pure assembly, no LLM here).
  await runSynthesizer({ briefId, brief, runs, finalPass: false });

  if ((allDispatched && allTerminal) || exceededTotalTimeout) {
    // Final pass: run reflection_ranker (LLM call) if it's part of the
    // route AND we have enough material; otherwise skip and finalize.
    const finalStatus = decideFinalStatus(total, failedCount, exceededTotalTimeout);
    await runSynthesizer({ briefId, brief, runs, finalPass: true });
    await markBriefComplete(briefId, finalStatus, brief.version);
    log.info("decision_orchestrator.brief_complete", {
      ...ctx,
      finalStatus,
      failedCount,
      total,
      exceededTotalTimeout,
    });
  }
}

function decideFinalStatus(
  total: number,
  failed: number,
  timedOut: boolean,
): "completed" | "partially_completed" | "failed" {
  if (failed >= total) return "failed";
  const halfFloor = Math.ceil(total / 2);
  if (failed >= halfFloor || timedOut) return "partially_completed";
  return "completed";
}

async function markBriefComplete(
  briefId: string,
  status: "completed" | "partially_completed" | "failed",
  prevVersion: number,
): Promise<void> {
  const { error } = await supabase
    .from("decision_briefs")
    .update({ status, version: prevVersion + 1 })
    .eq("id", briefId);
  if (error) throw new Error(`brief mark complete failed: ${error.message}`);

  // Emit the agent_artifact message and clear ephemeral thinking bubbles.
  const { error: delErr } = await supabase
    .from("decision_messages")
    .delete()
    .eq("brief_id", briefId)
    .eq("is_ephemeral", true);
  if (delErr) {
    log.warn("decision_orchestrator.ephemeral_cleanup_failed", { briefId, error: delErr.message });
  }

  // Look up session for the artifact insertion.
  const { data: brief } = await supabase
    .from("decision_briefs")
    .select("session_id")
    .eq("id", briefId)
    .maybeSingle();
  if (brief?.session_id) {
    await supabase.from("decision_messages").insert({
      session_id: brief.session_id,
      kind: "agent_artifact",
      content: null,
      brief_id: briefId,
    });
    await supabase
      .from("decision_sessions")
      .update({ last_msg_at: new Date().toISOString() })
      .eq("id", brief.session_id);
  }
}

// =====================================================================
// DB helpers
// =====================================================================
async function fetchBrief(briefId: string): Promise<DecisionBrief | null> {
  const { data, error } = await supabase
    .from("decision_briefs")
    .select("*")
    .eq("id", briefId)
    .maybeSingle();
  if (error) throw new Error(`brief fetch failed: ${error.message}`);
  return data as DecisionBrief | null;
}

async function fetchMechanismRuns(briefId: string): Promise<MechanismRun[]> {
  const { data, error } = await supabase
    .from("decision_mechanism_runs")
    .select("*")
    .eq("brief_id", briefId);
  if (error) throw new Error(`mechanism_runs fetch failed: ${error.message}`);
  return (data ?? []) as MechanismRun[];
}

void ALL_MECHANISMS;
