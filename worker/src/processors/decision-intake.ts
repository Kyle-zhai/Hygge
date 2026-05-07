// decision-intake.ts
// Intake Agent for the multi-agent decision analysis tool.
// Spec: docs/superpowers/specs/2026-05-06-multi-agent-decision-tool-design.md §5
//
// Reads the session message log, extracts routing fields, and either:
//   - asks the next clarifying question (top info-gain field) and sets
//     status to awaiting_user, OR
//   - emits an agent_confirmation with the routed mechanisms+personas, OR
//   - finalizes the Brief immediately if user clicked skip_run_now
//     OR accepted confirmation OR question budget is exhausted.
//
// State is implicit from the latest message kind in decision_messages —
// the processor short-circuits when the latest message is an agent question
// or confirmation that hasn't been replied to yet.

import type { Job } from "bullmq";
import { supabase } from "../supabase.js";
import { buildAuxLLM, type LLMOverrides } from "../llm/factory.js";
import {
  ALL_MECHANISMS,
  KNOWN_CONFIDENCE_THRESHOLD,
  MAX_INTAKE_QUESTIONS,
  type DecisionBrief,
  type DecisionMessage,
  type MechanismKind,
  type RoutingExtract,
  type SealedBy,
} from "../types/decision.js";
import type { Persona } from "../types/persona.js";
import { extractRoutingFields } from "../lib/extract-routing-fields.js";
import {
  pickNextField,
  allRequiredFilled,
} from "../lib/info-gain-scorer.js";
import { routeMechanisms } from "../lib/route-mechanisms.js";
import { pickPersonasForBrief } from "../lib/recommend-personas-from-brief.js";
import { robustJsonParse } from "../utils/json-parse.js";
import { log } from "../utils/logger.js";
import {
  INTAKE_QUESTION_SYSTEM,
  INTAKE_QUESTION_PROMPT_VERSION,
  buildQuestionUserPrompt,
} from "../prompts/intake-question.js";
import { INTAKE_EXTRACT_PROMPT_VERSION } from "../prompts/intake-extract.js";

export interface DecisionIntakeJobData {
  sessionId: string;
  llmOverrides?: LLMOverrides;
}

interface SessionRow {
  id: string;
  user_id: string;
  workspace_id: string | null;
}

const PROMPT_VERSION_TAG = `${INTAKE_EXTRACT_PROMPT_VERSION}+${INTAKE_QUESTION_PROMPT_VERSION}`;

export async function processDecisionIntakeJob(
  job: Job<DecisionIntakeJobData>,
): Promise<void> {
  const { sessionId, llmOverrides } = job.data;
  const ctx = { sessionId, jobId: job.id };
  log.info("decision_intake.start", ctx);

  const session = await fetchSession(sessionId);
  if (!session) throw new Error(`session ${sessionId} not found`);

  const messages = await fetchMessages(sessionId);
  if (messages.length === 0) {
    log.warn("decision_intake.empty_session", ctx);
    return;
  }

  const lastMessage = messages[messages.length - 1];

  // Short-circuit: the latest message is from the agent and we're awaiting
  // the user. Re-running here would be a duplicate question.
  if (
    lastMessage.kind === "agent_question" ||
    lastMessage.kind === "agent_confirmation" ||
    lastMessage.kind === "agent_thinking" ||
    lastMessage.kind === "agent_artifact"
  ) {
    log.info("decision_intake.noop_awaiting_user", { ...ctx, lastKind: lastMessage.kind });
    return;
  }

  const llm = buildAuxLLM(llmOverrides);

  // Identify whether we're in the initial-intake phase or the
  // post-confirmation phase (user replied to agent_confirmation).
  const lastConfirmation = findLastConfirmation(messages);
  const userMessagesAfterLastConfirmation = lastConfirmation
    ? messages.filter((m) => m.created_at > lastConfirmation.created_at && isUserKind(m.kind))
    : [];

  // Case A: user just replied to a confirmation.
  if (lastConfirmation && userMessagesAfterLastConfirmation.length > 0) {
    await handleConfirmationReply(
      session,
      lastConfirmation,
      userMessagesAfterLastConfirmation,
      messages,
      ctx,
    );
    return;
  }

  // Case B: Standard intake — extract, then either ask next question or emit
  // confirmation or finalize directly.
  await handleIntakeTurn(session, messages, llm, ctx);
}

// ============================================
// Standard intake turn
// ============================================
async function handleIntakeTurn(
  session: SessionRow,
  messages: DecisionMessage[],
  llm: ReturnType<typeof buildAuxLLM>,
  ctx: Record<string, unknown>,
): Promise<void> {
  const rawUserMessages = messages
    .filter((m) => isUserKind(m.kind))
    .map((m) => m.content ?? "")
    .filter((s) => s.length > 0);

  const userClickedSkip = messages.some((m) => m.kind === "user_skip_run");

  const priorAskedFields = collectAskedFields(messages);

  const extraction = await extractRoutingFields(
    llm,
    rawUserMessages,
    priorAskedFields,
  );

  const questionsAsked = countAgentQuestions(messages);

  // ─── Termination paths ─────────────────────────────────────────────
  if (userClickedSkip) {
    await finalizeAndConfirm(session, messages, extraction, "user_skip", llm, ctx);
    return;
  }

  if (allRequiredFilled(extraction.routing_extract)) {
    await emitConfirmation(session, messages, extraction, "all_required_filled", llm, ctx);
    return;
  }

  if (questionsAsked >= MAX_INTAKE_QUESTIONS) {
    await finalizeAndConfirm(
      session,
      messages,
      extraction,
      "budget_exhausted",
      llm,
      ctx,
    );
    return;
  }

  // ─── Ask next question ────────────────────────────────────────────
  const nextField = pickNextField(extraction.routing_extract, priorAskedFields);
  if (!nextField) {
    await emitConfirmation(session, messages, extraction, "all_required_filled", llm, ctx);
    return;
  }

  const language = detectLanguage(rawUserMessages);
  const knownFields = Object.entries(extraction.routing_extract).map(([field, f]) => ({
    field,
    value: f.value,
    confidence: f.confidence,
  }));
  const askedTexts = messages
    .filter((m) => m.kind === "agent_question")
    .map((m) => m.content ?? "");

  let questionPayload;
  try {
    const response = await llm.complete({
      system: INTAKE_QUESTION_SYSTEM,
      prompt: buildQuestionUserPrompt({
        rawUserMessages,
        candidateField: nextField.field,
        knownFields,
        questionsAlreadyAsked: askedTexts,
        language,
      }),
      maxTokens: 700,
      jsonMode: true,
    });
    questionPayload = robustJsonParse<{
      question_text: string;
      options: Array<{ id: string; label: string; is_recommended: boolean }>;
      field_being_asked: string;
    }>(response.text);
  } catch (err) {
    log.warn("decision_intake.question_llm_failed", {
      ...ctx,
      error: err instanceof Error ? err.message : String(err),
    });
    // Fallback: skip questioning, finalize with current best-guesses.
    await finalizeAndConfirm(
      session,
      messages,
      extraction,
      "auto_timeout",
      llm,
      ctx,
    );
    return;
  }

  if (
    questionPayload.field_being_asked === "none" ||
    !questionPayload.options ||
    questionPayload.options.length === 0
  ) {
    // LLM signals "nothing worth asking" → emit confirmation.
    await emitConfirmation(session, messages, extraction, "all_required_filled", llm, ctx);
    return;
  }

  // Persist updated draft Brief and the agent_question message atomically.
  const briefId = await upsertDraftBrief(session, messages, extraction);
  await insertMessage({
    session_id: session.id,
    kind: "agent_question",
    content: questionPayload.question_text,
    options: questionPayload.options,
    brief_id: briefId,
  });
  await touchSession(session.id);

  log.info("decision_intake.question_asked", {
    ...ctx,
    field: nextField.field,
    info_gain: nextField.info_gain,
    score: nextField.score,
  });
}

// ============================================
// Confirmation reply handling
// ============================================
async function handleConfirmationReply(
  session: SessionRow,
  confirmation: DecisionMessage,
  userReplies: DecisionMessage[],
  allMessages: DecisionMessage[],
  ctx: Record<string, unknown>,
): Promise<void> {
  const reply = userReplies[userReplies.length - 1];
  const briefId = confirmation.brief_id;
  if (!briefId) {
    log.error("decision_intake.confirmation_missing_brief", { ...ctx, confirmationId: confirmation.id });
    return;
  }

  const brief = await fetchBrief(briefId);
  if (!brief) throw new Error(`brief ${briefId} not found`);

  // Decide what the user said. Confirmation seal MUST come from a button
  // click (user_option with id="start"). Free-text replies are NOT
  // accepted as confirmations — earlier versions tried a regex match on
  // the first token but it false-positived on phrases like "running into
  // issues..." or "starting to think this through" and silently kicked
  // off the analysis.
  const optionId = reply.kind === "user_option" ? optionIdFromReply(reply) : null;

  if (optionId === "start") {
    await sealBriefAndEnqueueOrchestrator(brief, "all_required_filled", ctx);
    return;
  }

  if (optionId && optionId.startsWith("drop_")) {
    const kind = optionId.slice("drop_".length) as MechanismKind;
    const newMechanisms = brief.mechanisms.filter((m) => m.kind !== kind);
    const newKinds = newMechanisms.map((m) => m.kind);
    await supabase
      .from("decision_briefs")
      .update({ mechanisms: newMechanisms, mechanism_kinds: newKinds })
      .eq("id", brief.id)
      .eq("status", "draft"); // only mutate drafts; trigger blocks finalized
    await sealBriefAndEnqueueOrchestrator(
      { ...brief, mechanisms: newMechanisms },
      "all_required_filled",
      ctx,
    );
    return;
  }

  if (optionId === "swap_personas") {
    // For MVP, "swap" just re-runs persona selection from scratch.
    // A future iteration will accept explicit picks.
    await emitNewConfirmationFromBrief(session, brief, allMessages, ctx);
    return;
  }

  // Anything else: treat as cancel — leave brief in draft, do nothing.
  log.info("decision_intake.confirmation_cancel", { ...ctx, briefId });
}

// ============================================
// Finalize + emit confirmation helpers
// ============================================
async function emitConfirmation(
  session: SessionRow,
  messages: DecisionMessage[],
  extraction: Awaited<ReturnType<typeof extractRoutingFields>>,
  _sealReason: SealedBy,
  llm: ReturnType<typeof buildAuxLLM>,
  ctx: Record<string, unknown>,
): Promise<void> {
  const personas = await fetchActivePersonas();
  const route = routeMechanisms(extraction.routing_extract);
  const picked = await pickPersonasForBrief(
    llm,
    extraction.routing_extract,
    extraction.canonical_question,
    personas,
  );

  const briefId = await upsertDraftBrief(session, messages, extraction, {
    persona_ids: picked.persona_ids,
    mechanisms: route.mechanisms,
  });

  const language = detectLanguage(messages.map((m) => m.content ?? ""));
  const summary = buildConfirmationSummary(
    route.mechanisms.map((m) => m.kind),
    picked.persona_ids,
    personas,
    language,
  );

  const options = buildConfirmationOptions(route.mechanisms.map((m) => m.kind), language);

  await insertMessage({
    session_id: session.id,
    kind: "agent_confirmation",
    content: summary,
    options,
    brief_id: briefId,
  });
  await touchSession(session.id);

  log.info("decision_intake.confirmation_emitted", {
    ...ctx,
    briefId,
    mechanisms: route.mechanisms.map((m) => m.kind),
    personaCount: picked.persona_ids.length,
  });
}

async function emitNewConfirmationFromBrief(
  session: SessionRow,
  brief: DecisionBrief,
  allMessages: DecisionMessage[],
  ctx: Record<string, unknown>,
): Promise<void> {
  // Re-run persona pick + emit a fresh confirmation message.
  // Brief stays in draft; only the persona_ids and mechanism_kinds get refreshed.
  const llm = buildAuxLLM();
  const personas = await fetchActivePersonas();
  const picked = await pickPersonasForBrief(
    llm,
    brief.routing_extract,
    brief.canonical_question,
    personas.filter((p) => !brief.persona_ids.includes(p.id)),
  );
  const newPersonaIds = picked.persona_ids.length
    ? picked.persona_ids
    : brief.persona_ids;

  await supabase
    .from("decision_briefs")
    .update({ persona_ids: newPersonaIds })
    .eq("id", brief.id)
    .eq("status", "draft");

  const language = detectLanguage(allMessages.map((m) => m.content ?? ""));
  const summary = buildConfirmationSummary(
    brief.mechanisms.map((m) => m.kind),
    newPersonaIds,
    personas,
    language,
  );
  const options = buildConfirmationOptions(brief.mechanisms.map((m) => m.kind), language);

  await insertMessage({
    session_id: session.id,
    kind: "agent_confirmation",
    content: summary,
    options,
    brief_id: brief.id,
  });
  await touchSession(session.id);

  log.info("decision_intake.confirmation_re_emitted", { ...ctx, briefId: brief.id });
}

async function finalizeAndConfirm(
  session: SessionRow,
  messages: DecisionMessage[],
  extraction: Awaited<ReturnType<typeof extractRoutingFields>>,
  sealReason: SealedBy,
  llm: ReturnType<typeof buildAuxLLM>,
  ctx: Record<string, unknown>,
): Promise<void> {
  // Skip-run path: route + pick personas + finalize immediately, no
  // confirmation step. Spec §5.3 — skip is always a one-click path.
  const personas = await fetchActivePersonas();
  const route = routeMechanisms(extraction.routing_extract);
  const picked = await pickPersonasForBrief(
    llm,
    extraction.routing_extract,
    extraction.canonical_question,
    personas,
  );
  const briefId = await upsertDraftBrief(session, messages, extraction, {
    persona_ids: picked.persona_ids,
    mechanisms: route.mechanisms,
  });

  const brief = await fetchBrief(briefId);
  if (!brief) throw new Error(`brief ${briefId} disappeared after upsert`);
  await sealBriefAndEnqueueOrchestrator(brief, sealReason, ctx);
}

async function sealBriefAndEnqueueOrchestrator(
  brief: DecisionBrief,
  sealReason: SealedBy,
  ctx: Record<string, unknown>,
): Promise<void> {
  // A brief that seals with an empty persona pool would feed N mechanism
  // jobs that each call the LLM with personas=[] and predictably produce
  // empty findings — a "completed" but useless artifact. This usually
  // means persona selection hit the regex fallback during an LLM outage.
  // Surface the failure to the user instead of silently shipping garbage.
  if (!brief.persona_ids || brief.persona_ids.length === 0) {
    log.warn("decision_intake.seal_blocked_empty_personas", { ...ctx, briefId: brief.id });
    await supabase
      .from("decision_briefs")
      .update({ status: "failed", finalized_at: new Date().toISOString(), sealed_by: sealReason })
      .eq("id", brief.id)
      .eq("status", "draft");
    await insertMessage({
      session_id: brief.session_id,
      kind: "system",
      content:
        "我没能选到合适的 persona 来分析这个决策(LLM 暂时不可用)。请稍后重试或换个问题描述。",
      brief_id: brief.id,
    });
    await touchSession(brief.session_id);
    return;
  }

  const { error } = await supabase
    .from("decision_briefs")
    .update({
      status: "finalized",
      sealed_by: sealReason,
      finalized_at: new Date().toISOString(),
      version: brief.version + 1,
    })
    .eq("id", brief.id)
    .eq("status", "draft"); // optimistic — only finalize a still-draft Brief

  if (error) throw new Error(`brief seal failed: ${error.message}`);

  // Emit a transient agent_thinking message so the UI immediately has
  // feedback that analysis has started.
  await insertMessage({
    session_id: brief.session_id,
    kind: "agent_thinking",
    content: "正在编排分析...",
    is_ephemeral: true,
    brief_id: brief.id,
  });
  await touchSession(brief.session_id);

  // Enqueue the orchestrator. We do a dynamic import to avoid a circular
  // dependency at module-load time.
  const { decisionOrchestratorQueue } = await import("../queue.js");
  await decisionOrchestratorQueue.add(
    "orchestrate",
    { briefId: brief.id },
    { jobId: `orch:${brief.id}` },
  );

  log.info("decision_intake.sealed", {
    ...ctx,
    briefId: brief.id,
    sealReason,
    mechanisms: brief.mechanisms.map((m) => m.kind),
    personaCount: brief.persona_ids.length,
  });
}

// ============================================
// DB helpers
// ============================================
async function fetchSession(sessionId: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from("decision_sessions")
    .select("id, user_id, workspace_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`session fetch failed: ${error.message}`);
  return data;
}

async function fetchMessages(sessionId: string): Promise<DecisionMessage[]> {
  const { data, error } = await supabase
    .from("decision_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`messages fetch failed: ${error.message}`);
  return (data ?? []) as DecisionMessage[];
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

async function fetchActivePersonas(): Promise<Persona[]> {
  const { data, error } = await supabase
    .from("personas")
    .select("*")
    .eq("is_active", true)
    .limit(50);
  if (error) {
    // Some schemas don't have is_active — fall back to fetching all.
    const fallback = await supabase.from("personas").select("*").limit(50);
    if (fallback.error) throw new Error(`personas fetch failed: ${fallback.error.message}`);
    return (fallback.data ?? []) as Persona[];
  }
  return (data ?? []) as Persona[];
}

async function insertMessage(msg: {
  session_id: string;
  kind: DecisionMessage["kind"];
  content?: string | null;
  options?: DecisionMessage["options"];
  brief_id?: string | null;
  is_ephemeral?: boolean;
}): Promise<void> {
  const { error } = await supabase.from("decision_messages").insert({
    session_id: msg.session_id,
    kind: msg.kind,
    content: msg.content ?? null,
    options: msg.options ?? null,
    brief_id: msg.brief_id ?? null,
    is_ephemeral: msg.is_ephemeral ?? false,
  });
  if (error) throw new Error(`message insert failed: ${error.message}`);
}

async function touchSession(sessionId: string): Promise<void> {
  await supabase
    .from("decision_sessions")
    .update({ last_msg_at: new Date().toISOString() })
    .eq("id", sessionId);
}

interface UpsertOverrides {
  persona_ids?: string[];
  mechanisms?: DecisionBrief["mechanisms"];
}

async function upsertDraftBrief(
  session: SessionRow,
  messages: DecisionMessage[],
  extraction: Awaited<ReturnType<typeof extractRoutingFields>>,
  overrides: UpsertOverrides = {},
): Promise<string> {
  const existingDraft = await supabase
    .from("decision_briefs")
    .select("id, parent_brief_id, version")
    .eq("session_id", session.id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rawUserMessages = messages
    .filter((m) => isUserKind(m.kind))
    .map((m) => m.content ?? "")
    .filter(Boolean);

  const questionLog = buildQuestionLogFromMessages(messages);

  const avgConf = avgConfidence(extraction.routing_extract);

  const payload = {
    session_id: session.id,
    canonical_question: extraction.canonical_question,
    routing_extract: extraction.routing_extract,
    raw_user_messages: rawUserMessages,
    question_log: questionLog,
    decision_type: extraction.routing_extract.decision_type.value,
    primary_dimensions: extraction.routing_extract.primary_dimensions.value,
    persona_ids: overrides.persona_ids ?? [],
    mechanisms: overrides.mechanisms ?? [],
    mechanism_kinds: (overrides.mechanisms ?? []).map((m) => m.kind),
    total_intake_tokens: extraction.tokens_used,
    extraction_confidence_avg: avgConf,
    llm_model: "aux",
    prompt_version: PROMPT_VERSION_TAG,
  };

  if (existingDraft.data) {
    const { error } = await supabase
      .from("decision_briefs")
      .update(payload)
      .eq("id", existingDraft.data.id);
    if (error) throw new Error(`brief update failed: ${error.message}`);
    return existingDraft.data.id;
  }

  const { data, error } = await supabase
    .from("decision_briefs")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(`brief insert failed: ${error.message}`);
  return data.id as string;
}

// ============================================
// Pure helpers
// ============================================
function isUserKind(k: DecisionMessage["kind"]): boolean {
  return k === "user_text" || k === "user_option" || k === "user_skip_run";
}

function findLastConfirmation(messages: DecisionMessage[]): DecisionMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].kind === "agent_confirmation") return messages[i];
  }
  return null;
}

function countAgentQuestions(messages: DecisionMessage[]): number {
  return messages.filter((m) => m.kind === "agent_question").length;
}

function collectAskedFields(messages: DecisionMessage[]): Set<string> {
  // Each agent_question stored its options. The corresponding answer in the
  // following user message tells us which field was being resolved. For the
  // MVP we record the field as a tag on the options[0] payload via the
  // intake-question prompt — but since we don't currently round-trip that,
  // an empty set just means "we'll let info-gain re-decide". Safe.
  void messages;
  return new Set();
}

function optionIdFromReply(reply: DecisionMessage): string | null {
  // user_option content is the option id by convention; the API layer is
  // responsible for storing it that way.
  return reply.content ?? null;
}

function buildQuestionLogFromMessages(messages: DecisionMessage[]) {
  const log_: Array<{
    question_text: string;
    options: DecisionMessage["options"];
    answer: { kind: "option" | "free_text" | "skip_run_now"; value: string };
    info_gain_score: number;
    asked_at: string;
  }> = [];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.kind !== "agent_question") continue;
    const next = messages[i + 1];
    if (!next || !isUserKind(next.kind)) continue;
    log_.push({
      question_text: m.content ?? "",
      options: m.options ?? null,
      answer: {
        kind:
          next.kind === "user_skip_run"
            ? "skip_run_now"
            : next.kind === "user_option"
            ? "option"
            : "free_text",
        value: next.content ?? "",
      },
      info_gain_score: 0,
      asked_at: m.created_at,
    });
  }
  return log_;
}

function avgConfidence(extract: RoutingExtract): number {
  const fields = Object.values(extract);
  if (fields.length === 0) return 0;
  const sum = fields.reduce((acc, f) => acc + (f.confidence ?? 0), 0);
  return Number((sum / fields.length).toFixed(2));
}

function detectLanguage(messages: string[]): "en" | "zh" {
  const sample = messages.join(" ").slice(0, 400);
  // Crude but sufficient: any CJK character implies zh.
  return /[㐀-鿿]/.test(sample) ? "zh" : "en";
}

function buildConfirmationSummary(
  mechanismKinds: MechanismKind[],
  personaIds: string[],
  personas: Persona[],
  language: "en" | "zh",
): string {
  const personaNames = personaIds
    .map((id) => personas.find((p) => p.id === id)?.identity.name ?? id)
    .slice(0, 6);

  if (language === "zh") {
    return [
      "我准备从这几个角度帮你分析:",
      ...mechanismKinds.map((k) => `· ${mechanismLabelZh(k)}`),
      "",
      `参与的 personas: ${personaNames.join(" · ")}`,
    ].join("\n");
  }
  return [
    "I'll analyze your decision using:",
    ...mechanismKinds.map((k) => `· ${mechanismLabelEn(k)}`),
    "",
    `Personas: ${personaNames.join(" · ")}`,
  ].join("\n");
}

function buildConfirmationOptions(
  mechanismKinds: MechanismKind[],
  language: "en" | "zh",
) {
  const startLabel = language === "zh" ? "开始分析" : "Start analysis";
  const swapLabel = language === "zh" ? "换一组 personas" : "Swap personas";
  const opts = [
    { id: "start", label: startLabel, is_recommended: true },
    { id: "swap_personas", label: swapLabel, is_recommended: false },
  ];
  for (const k of mechanismKinds) {
    if (k === "scenario_simulation" || k === "theory_of_mind" || k === "cross_challenge") {
      opts.push({
        id: `drop_${k}`,
        label:
          language === "zh"
            ? `跳过 ${mechanismLabelZh(k)}`
            : `Skip ${mechanismLabelEn(k)}`,
        is_recommended: false,
      });
    }
  }
  return opts;
}

function mechanismLabelZh(k: MechanismKind): string {
  switch (k) {
    case "persona_review": return "Persona 各自分析";
    case "round_table_debate": return "圆桌辩论";
    case "scenario_simulation": return "场景模拟";
    case "theory_of_mind": return "心智理论";
    case "cross_challenge": return "交叉挑战";
    case "reflection_ranker": return "反思排序";
  }
}

function mechanismLabelEn(k: MechanismKind): string {
  switch (k) {
    case "persona_review": return "Persona review";
    case "round_table_debate": return "Round-table debate";
    case "scenario_simulation": return "Scenario simulation";
    case "theory_of_mind": return "Theory of mind";
    case "cross_challenge": return "Cross-challenge";
    case "reflection_ranker": return "Reflection ranker";
  }
}

// Touch — silence "unused" warnings for symbols that are part of the public
// surface even when this MVP path doesn't exercise them yet.
void ALL_MECHANISMS;
void KNOWN_CONFIDENCE_THRESHOLD;
