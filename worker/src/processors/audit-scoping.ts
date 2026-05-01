// audit-scoping.ts
//
// Multi-agent audit kernel: state-machine processor for the conversational
// scoping session (Layer 1a + Layer 1b).
// Spec: docs/superpowers/specs/2026-04-30-multi-agent-audit-architecture.md §3, §4
//
// Job data is just { scopingId }. The processor:
//   1. Loads the audit_scoping_sessions row.
//   2. If status='created', runs Layer 1a (annotation) and flips to 'scoping'.
//   3. While status='scoping' (or 'annotating' just-flipped), runs Layer 1b
//      turns until either:
//        - the agent asks → status='awaiting_user', return (user resumes via API)
//        - the agent says done → status='scope_locked'
//        - we hit the per-job turn cap → persist & return (re-queue elsewhere)
//
// Idempotent: terminal states ('scope_locked', 'failed', 'awaiting_user')
// short-circuit immediately. Re-running on 'awaiting_user' is a no-op so a
// retry can't accidentally clobber a pending question.

import type { Job } from "bullmq";
import { supabase } from "../supabase.js";
import { buildAuxLLM, type LLMOverrides } from "../llm/factory.js";
import { log } from "../utils/logger.js";
import { annotatePassages, type AnnotatedPassage } from "../audit/annotation.js";
import {
  runScopingTurn,
  type ConversationTurn,
  type LawCatalogRow,
  type PendingQuestion,
  type ScopedLaw,
  type ScopingTurnInput,
} from "../audit/scoping-agent.js";

// ============================================
// Job shape + tunables
// ============================================
export interface AuditScopingJobData {
  scopingId: string;
  llmOverrides?: LLMOverrides;
  /** "en" | "zh"; surfaces in question text. Defaults to "en". */
  replyLanguage?: "en" | "zh";
}

const MAX_TURNS_PER_JOB = 6; // soft cap so a single job can't loop forever
const MAX_PASSAGES_FOR_LLM = 60; // Layer 1b prompt budget; truncate if upload is huge

// ============================================
// DB row shapes
// ============================================
interface ScopingRow {
  id: string;
  audit_session_id: string;
  status: "created" | "annotating" | "scoping" | "awaiting_user" | "scope_locked" | "failed";
  passages: AnnotatedPassage[];
  cursor: number;
  conversation: ConversationTurn[];
  pending_question: PendingQuestion | null;
  scope_in: ScopedLaw[];
  scope_out: ScopedLaw[];
  question_count: number;
  max_questions: number;
  error_message: string | null;
  error_count: number;
}

interface AuditSessionRow {
  decision_text: string;
}

// ============================================
// Helpers
// ============================================
function nowIso(): string {
  return new Date().toISOString();
}

function unionAnnotations(passages: AnnotatedPassage[]): string[] {
  const set = new Set<string>();
  for (const p of passages) {
    for (const a of p.annotations) set.add(a);
  }
  return Array.from(set);
}

function isCandidateLeft(
  candidates: LawCatalogRow[],
  scope_in: ScopedLaw[],
  scope_out: ScopedLaw[],
): boolean {
  const decided = new Set<string>([
    ...scope_in.map((s) => s.law_id),
    ...scope_out.map((s) => s.law_id),
  ]);
  return candidates.some((c) => !decided.has(c.id));
}

async function loadCandidateLaws(annotations: string[]): Promise<LawCatalogRow[]> {
  if (annotations.length === 0) {
    // No annotations matched: still pull wedge laws so we always evaluate AI governance.
    const { data, error } = await supabase
      .from("audit_law_catalog")
      .select("id, name_en, name_zh, jurisdiction, category, trigger_annotations, trigger_questions, is_wedge")
      .eq("is_active", true)
      .eq("is_wedge", true);
    if (error) throw new Error(`audit_law_catalog wedge fetch failed: ${error.message}`);
    return (data ?? []) as LawCatalogRow[];
  }
  const { data, error } = await supabase
    .from("audit_law_catalog")
    .select("id, name_en, name_zh, jurisdiction, category, trigger_annotations, trigger_questions, is_wedge")
    .eq("is_active", true)
    .overlaps("trigger_annotations", annotations);
  if (error) throw new Error(`audit_law_catalog overlap fetch failed: ${error.message}`);
  return (data ?? []) as LawCatalogRow[];
}

function truncatePassagesForPrompt(passages: AnnotatedPassage[]): AnnotatedPassage[] {
  if (passages.length <= MAX_PASSAGES_FOR_LLM) return passages;
  // Keep cursor + tail biased: cursor will most often be near the front, but if
  // it's drifted past the head we want recent passages too. Strategy: take the
  // first MAX/2, then the last MAX/2.
  const half = Math.floor(MAX_PASSAGES_FOR_LLM / 2);
  return [...passages.slice(0, half), ...passages.slice(-half)];
}

function appendConversation(
  existing: ConversationTurn[],
  added: ConversationTurn[],
): ConversationTurn[] {
  if (added.length === 0) return existing;
  const stamped = added.map((t) => ({ ...t, ts: t.ts ?? nowIso() }));
  return [...existing, ...stamped];
}

function dedupeScopedLaws(existing: ScopedLaw[], added: ScopedLaw[]): ScopedLaw[] {
  const byId = new Map<string, ScopedLaw>();
  for (const s of existing) byId.set(s.law_id, s);
  for (const s of added) byId.set(s.law_id, s); // last write wins on a re-resolve
  return Array.from(byId.values());
}

function questionToConversationTurn(q: PendingQuestion): ConversationTurn {
  return {
    role: "system",
    kind: "question",
    text: q.text,
    ts: nowIso(),
    refs: { question_id: q.id, passage_idx: q.asked_at_passage_idx },
  };
}

// ============================================
// Main entry
// ============================================
export async function processAuditScopingJob(job: Job<AuditScopingJobData>): Promise<void> {
  const { scopingId, llmOverrides, replyLanguage = "en" } = job.data;
  const ctx = { scopingId, jobId: job.id };

  log.info("audit_scoping.start", ctx);

  const row = await fetchScopingRow(scopingId);
  if (!row) throw new Error(`scoping session ${scopingId} not found`);

  // Terminal / paused states: nothing to do.
  if (row.status === "scope_locked" || row.status === "awaiting_user" || row.status === "failed") {
    log.info("audit_scoping.noop", { ...ctx, status: row.status });
    return;
  }

  const llm = buildAuxLLM(llmOverrides);

  // Layer 1a: annotation (only on the first job for this session).
  let working = row;
  if (working.status === "created") {
    working = await runAnnotationPhase(working, llm);
  }

  // Layer 1b: scoping loop.
  await runScopingPhase(working, llm, replyLanguage);

  log.info("audit_scoping.complete", ctx);
}

// ============================================
// Layer 1a: annotation phase
// ============================================
async function runAnnotationPhase(
  row: ScopingRow,
  llm: ReturnType<typeof buildAuxLLM>,
): Promise<ScopingRow> {
  // Mark annotating so a parallel retry sees we're in progress.
  await persistStatus(row.id, "annotating");

  const session = await fetchAuditSession(row.audit_session_id);
  if (!session?.decision_text || !session.decision_text.trim()) {
    await persistFailure(row.id, "audit session has no decision_text to annotate");
    throw new Error("audit session has empty decision_text");
  }

  const passages = await annotatePassages(session.decision_text, llm);
  if (passages.length === 0) {
    await persistFailure(row.id, "annotation produced no passages");
    throw new Error("annotation produced no passages");
  }

  const { error } = await supabase
    .from("audit_scoping_sessions")
    .update({
      passages,
      status: "scoping",
      cursor: 0,
    })
    .eq("id", row.id);
  if (error) throw new Error(`scoping passages persist failed: ${error.message}`);

  log.info("audit_scoping.annotation_done", {
    scopingId: row.id,
    passageCount: passages.length,
    annotationCount: unionAnnotations(passages).length,
  });

  return { ...row, passages, status: "scoping", cursor: 0 };
}

// ============================================
// Layer 1b: scoping phase (one or more turns)
// ============================================
async function runScopingPhase(
  row: ScopingRow,
  llm: ReturnType<typeof buildAuxLLM>,
  replyLanguage: "en" | "zh",
): Promise<void> {
  let state: ScopingRow = row;
  let turnsThisJob = 0;

  while (turnsThisJob < MAX_TURNS_PER_JOB) {
    if (state.status !== "scoping") return; // someone else moved us; stop.

    const annotationsUnion = unionAnnotations(state.passages);
    const candidates = await loadCandidateLaws(annotationsUnion);

    // Termination check: nothing more to discuss → finalize.
    const cursorPastEnd = state.cursor >= state.passages.length;
    if (cursorPastEnd && !isCandidateLeft(candidates, state.scope_in, state.scope_out)) {
      await persistScopeLocked(state.id);
      log.info("audit_scoping.auto_locked", { scopingId: state.id, reason: "no_candidates_left" });
      return;
    }

    // Question budget exhausted: lock with whatever we have, mark remaining out.
    if (state.question_count >= state.max_questions) {
      await persistBudgetExhausted(state, candidates);
      log.info("audit_scoping.budget_exhausted_locked", {
        scopingId: state.id,
        questionCount: state.question_count,
      });
      return;
    }

    const input: ScopingTurnInput = {
      passages: truncatePassagesForPrompt(state.passages),
      cursor: state.cursor,
      conversation: state.conversation,
      scope_in: state.scope_in,
      scope_out: state.scope_out,
      candidate_laws: candidates,
      question_count: state.question_count,
      max_questions: state.max_questions,
      reply_language: replyLanguage,
    };

    const action = await runScopingTurn(llm, input);
    turnsThisJob++;

    if (action.kind === "ask") {
      const newConversation = appendConversation(state.conversation, [
        ...(action.notes ?? []),
        questionToConversationTurn(action.question),
      ]);
      const { error } = await supabase
        .from("audit_scoping_sessions")
        .update({
          status: "awaiting_user",
          pending_question: action.question,
          conversation: newConversation,
        })
        .eq("id", state.id);
      if (error) throw new Error(`scoping ask persist failed: ${error.message}`);
      log.info("audit_scoping.asked", {
        scopingId: state.id,
        questionId: action.question.id,
      });
      return;
    }

    if (action.kind === "done") {
      await persistScopeLocked(state.id, action.notes ?? [], state.conversation);
      log.info("audit_scoping.agent_done", { scopingId: state.id });
      return;
    }

    // commit
    const newScopeIn = dedupeScopedLaws(state.scope_in, action.add_to_scope_in);
    const newScopeOut = dedupeScopedLaws(state.scope_out, action.add_to_scope_out);
    const newCursor = Math.min(state.passages.length, state.cursor + action.cursor_advance);
    const newConversation = appendConversation(state.conversation, action.notes ?? []);

    const { error } = await supabase
      .from("audit_scoping_sessions")
      .update({
        scope_in: newScopeIn,
        scope_out: newScopeOut,
        cursor: newCursor,
        conversation: newConversation,
      })
      .eq("id", state.id);
    if (error) throw new Error(`scoping commit persist failed: ${error.message}`);

    state = {
      ...state,
      scope_in: newScopeIn,
      scope_out: newScopeOut,
      cursor: newCursor,
      conversation: newConversation,
    };

    log.info("audit_scoping.committed", {
      scopingId: state.id,
      addInCount: action.add_to_scope_in.length,
      addOutCount: action.add_to_scope_out.length,
      cursor: newCursor,
    });
  }

  // Hit per-job turn cap with state still scoping. Just return; caller can
  // re-queue (e.g. cron sweeper or API) to continue.
  log.warn("audit_scoping.turn_cap_hit", {
    scopingId: state.id,
    turnsThisJob,
    cursor: state.cursor,
  });
}

// ============================================
// Persistence helpers
// ============================================
async function fetchScopingRow(id: string): Promise<ScopingRow | null> {
  const { data, error } = await supabase
    .from("audit_scoping_sessions")
    .select(
      "id, audit_session_id, status, passages, cursor, conversation, pending_question, scope_in, scope_out, question_count, max_questions, error_message, error_count",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`scoping fetch failed: ${error.message}`);
  return (data as ScopingRow | null) ?? null;
}

async function fetchAuditSession(id: string): Promise<AuditSessionRow | null> {
  const { data, error } = await supabase
    .from("audit_sessions")
    .select("decision_text")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`audit session fetch failed: ${error.message}`);
  return (data as AuditSessionRow | null) ?? null;
}

async function persistStatus(id: string, status: ScopingRow["status"]): Promise<void> {
  const { error } = await supabase
    .from("audit_scoping_sessions")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(`scoping status->${status} persist failed: ${error.message}`);
}

async function persistFailure(id: string, message: string): Promise<void> {
  await supabase
    .from("audit_scoping_sessions")
    .update({
      status: "failed",
      error_message: message.slice(0, 2000),
      error_count: 1,
    })
    .eq("id", id);
}

async function persistScopeLocked(
  id: string,
  notes: ConversationTurn[] = [],
  baseConversation: ConversationTurn[] = [],
): Promise<void> {
  const conversation = appendConversation(baseConversation, notes);
  const update: Record<string, unknown> = {
    status: "scope_locked",
    pending_question: null,
    scope_locked_at: nowIso(),
  };
  if (notes.length > 0) update.conversation = conversation;

  const { error } = await supabase.from("audit_scoping_sessions").update(update).eq("id", id);
  if (error) throw new Error(`scoping lock persist failed: ${error.message}`);
}

async function persistBudgetExhausted(state: ScopingRow, candidates: LawCatalogRow[]): Promise<void> {
  const decided = new Set<string>([
    ...state.scope_in.map((s) => s.law_id),
    ...state.scope_out.map((s) => s.law_id),
  ]);
  const undecidedOuts: ScopedLaw[] = candidates
    .filter((c) => !decided.has(c.id))
    .map((c) => ({
      law_id: c.id,
      status: "out",
      reason: "undecidable: question budget exhausted; defer to next pass",
      passage_refs: [],
    }));

  const note: ConversationTurn = {
    role: "system",
    kind: "scope_update",
    text: `Question budget (${state.max_questions}) reached; ${undecidedOuts.length} candidate(s) auto-marked out.`,
    ts: nowIso(),
  };

  const newScopeOut = dedupeScopedLaws(state.scope_out, undecidedOuts);
  const newConversation = appendConversation(state.conversation, [note]);

  const { error } = await supabase
    .from("audit_scoping_sessions")
    .update({
      status: "scope_locked",
      pending_question: null,
      scope_out: newScopeOut,
      conversation: newConversation,
      scope_locked_at: nowIso(),
    })
    .eq("id", state.id);
  if (error) throw new Error(`scoping budget-lock persist failed: ${error.message}`);
}
