// scoping-agent.ts
//
// Multi-agent audit kernel: Layer 1b — conversational scoping turn.
// Spec: docs/superpowers/specs/2026-04-30-multi-agent-audit-architecture.md §3, §4
//
// One call to runScopingTurn() = one decision by the agent. The processor
// (audit-scoping.ts) loops over turns, persisting state between each.
//
// On each turn the agent sees the full upload (annotated passages), the full
// conversation so far, the current scope_in / scope_out, and the catalog rows
// already matched by annotations. It returns one of:
//
//   - ask:    "I need a yes/no on EU users before I can decide GDPR / EU AI Act."
//   - commit: "Lock NIST AI RMF in-scope, lock NYC LL144 out-of-scope."
//   - done:   "All passages reviewed, all candidates decided, ready to finalize."
//
// The agent does not directly mutate state. The processor takes the action and
// applies it via record_scoping_answer / direct table updates.

import type { LLMAdapter } from "../llm/adapter.js";
import { robustJsonParse } from "../utils/json-parse.js";
import { log } from "../utils/logger.js";
import type { AnnotatedPassage } from "./annotation.js";

// ============================================
// Public types
// ============================================
export type AnswerFormat = "yes_no" | "single_select" | "free_text";

export interface PendingQuestion {
  id: string;
  text: string;
  context: string;
  answer_format: AnswerFormat;
  options: string[] | null;
  asked_at_passage_idx: number;
}

export type ConversationRole = "system" | "user";
export type ConversationKind = "question" | "answer" | "scope_update" | "note";

export interface ConversationTurn {
  role: ConversationRole;
  kind: ConversationKind;
  text: string;
  ts?: string;
  refs?: {
    passage_idx?: number;
    law_id?: string;
    question_id?: string;
  };
}

export interface ScopedLaw {
  law_id: string;
  status: "in" | "out";
  reason: string;
  passage_refs: number[];
}

export interface LawCatalogRow {
  id: string;
  name_en: string;
  name_zh: string;
  jurisdiction: string;
  category: string;
  trigger_annotations: string[];
  trigger_questions: string[];
  is_wedge: boolean;
}

export interface ScopingTurnInput {
  passages: AnnotatedPassage[];
  cursor: number;
  conversation: ConversationTurn[];
  scope_in: ScopedLaw[];
  scope_out: ScopedLaw[];
  candidate_laws: LawCatalogRow[];
  question_count: number;
  max_questions: number;
  /** "en" | "zh"; controls language of the question text and notes. */
  reply_language: "en" | "zh";
}

export type ScopingAction =
  | {
      kind: "ask";
      question: PendingQuestion;
      notes?: ConversationTurn[];
    }
  | {
      kind: "commit";
      add_to_scope_in: ScopedLaw[];
      add_to_scope_out: ScopedLaw[];
      cursor_advance: number;
      notes?: ConversationTurn[];
    }
  | {
      kind: "done";
      notes?: ConversationTurn[];
    };

// ============================================
// Raw LLM output shape (pre-validation)
// ============================================
interface RawScopingOutput {
  action?: string;
  question?: {
    id?: string;
    text?: string;
    context?: string;
    answer_format?: string;
    options?: unknown;
    asked_at_passage_idx?: number;
  };
  add_to_scope_in?: unknown;
  add_to_scope_out?: unknown;
  cursor_advance?: number;
  notes?: unknown;
}

// ============================================
// Prompt builders
// ============================================
function renderPassages(passages: AnnotatedPassage[], cursor: number): string {
  if (passages.length === 0) return "(no passages)";
  return passages
    .map((p) => {
      const marker = p.idx === cursor ? "  ← cursor" : p.idx < cursor ? "  (reviewed)" : "";
      const tags = p.annotations.length > 0 ? ` [${p.annotations.join(", ")}]` : " [none]";
      return `[${p.idx}]${tags}${marker}\n${p.text}`;
    })
    .join("\n\n");
}

function renderConversation(conversation: ConversationTurn[]): string {
  if (conversation.length === 0) return "(no prior turns)";
  return conversation
    .map((t) => {
      const refs = t.refs
        ? ` ${Object.entries(t.refs)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => `${k}=${v}`)
            .join(",")}`
        : "";
      return `- [${t.role}/${t.kind}${refs}] ${t.text}`;
    })
    .join("\n");
}

function renderScope(scope: ScopedLaw[], label: string): string {
  if (scope.length === 0) return `(${label}: none yet)`;
  return scope
    .map((s) => `- ${s.law_id} :: ${s.reason} (passages: ${s.passage_refs.join(",") || "—"})`)
    .join("\n");
}

function renderCandidateLaws(rows: LawCatalogRow[]): string {
  if (rows.length === 0) return "(no candidate laws matched by annotations)";
  return rows
    .map((r) => {
      const wedge = r.is_wedge ? " [WEDGE]" : "";
      const triggers = r.trigger_annotations.slice(0, 8).join(", ");
      const questions = r.trigger_questions
        .slice(0, 3)
        .map((q) => `    • ${q}`)
        .join("\n");
      return [
        `- ${r.id} (${r.jurisdiction}, ${r.category})${wedge}: ${r.name_en}`,
        `  triggers: ${triggers}`,
        questions ? `  example clarifying questions:\n${questions}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

function buildScopingSystem(): string {
  return [
    "You are Layer 1b of a multi-agent audit kernel: the conversational scoping agent.",
    "You decide which laws / frameworks belong IN-SCOPE vs OUT-OF-SCOPE for a deployment audit, asking the user only when annotations + conversation are not enough to decide.",
    "",
    "## Inputs you receive every turn",
    "- Annotated passages from the user's upload (Layer 1a output).",
    "- Cursor position: passages before it have been reviewed; the cursor passage is the current focus; passages after it are pending.",
    "- The full conversation so far.",
    "- Current scope_in and scope_out.",
    "- Candidate laws (catalog rows whose trigger_annotations overlap with at least one passage).",
    "- Question count + max question budget. NEVER exceed the budget.",
    "",
    "## Decision rules (apply in order)",
    "1. If the user has clearly answered a question and the answer lets you commit a law to scope_in or scope_out, do `commit`.",
    "2. If a candidate law's trigger_annotations strongly fire AND the user's prior answers / passage text already settle the law's status, do `commit`. Be willing to mark things `out` (e.g. NYC LL144 when the user has confirmed no NYC employment) — out-of-scope is a feature, not a failure.",
    "3. If a candidate law cannot be decided without user input, do `ask` with ONE focused question. Prefer `yes_no` where possible. Never bundle two questions into one.",
    "4. If the cursor is past the last passage AND every candidate law has been resolved, do `done`.",
    "5. If the question budget is exhausted, do `commit` for everything decidable and `done` for everything remaining (mark unresolved candidates as scope_out with reason 'undecidable: question budget exhausted').",
    "",
    "## Hard constraints",
    "- Only reference law_id values from candidate_laws or already-locked scope. Never invent law ids.",
    "- A passage_refs entry must be a valid passage idx that exists in the input.",
    "- For `ask`, generate a stable id (e.g. `q_<short_topic>`). The id must be unique across the conversation.",
    "- Wedge laws (NIST AI RMF, ISO/IEC 42001) almost always go scope_in for AI deployments. Don't ask whether to include them unless the user explicitly objected.",
    "- Cursor_advance on commit can be 0 (we just resolved a law, cursor stays) or positive (we processed the cursor passage and one or more after it).",
    "",
    "## Output JSON schema",
    "Return ONLY a JSON object with this exact shape (no extra keys):",
    "{",
    '  "action": "ask" | "commit" | "done",',
    "  // for ask:",
    '  "question": {',
    '    "id": "q_short_id",',
    '    "text": "<the question to show the user>",',
    '    "context": "<one-line why this matters>",',
    '    "answer_format": "yes_no" | "single_select" | "free_text",',
    '    "options": ["A","B"] | null,  // required for single_select',
    '    "asked_at_passage_idx": <int>',
    "  },",
    "  // for commit:",
    '  "add_to_scope_in":  [{ "law_id":"...", "status":"in",  "reason":"...", "passage_refs":[<int>,...] }],',
    '  "add_to_scope_out": [{ "law_id":"...", "status":"out", "reason":"...", "passage_refs":[<int>,...] }],',
    '  "cursor_advance": <int>,',
    "  // optional, any action:",
    '  "notes": [{ "role":"system", "kind":"note"|"scope_update", "text":"...", "refs":{...} }]',
    "}",
  ].join("\n");
}

function buildScopingPrompt(input: ScopingTurnInput): string {
  const remainingBudget = Math.max(0, input.max_questions - input.question_count);
  const langNote =
    input.reply_language === "zh"
      ? "Answer the user in Simplified Chinese. Question text and notes must be in 简体中文."
      : "Answer the user in English.";
  return [
    `## Cursor: ${input.cursor} of ${input.passages.length} passages`,
    `## Question budget: ${remainingBudget} of ${input.max_questions} remaining`,
    "",
    "## Annotated passages",
    renderPassages(input.passages, input.cursor),
    "",
    "## Conversation so far",
    renderConversation(input.conversation),
    "",
    "## Currently locked scope_in",
    renderScope(input.scope_in, "scope_in"),
    "",
    "## Currently locked scope_out",
    renderScope(input.scope_out, "scope_out"),
    "",
    "## Candidate laws (annotation matches)",
    renderCandidateLaws(input.candidate_laws),
    "",
    "## Language",
    langNote,
    "",
    "Decide one action now. Return JSON only.",
  ].join("\n");
}

// ============================================
// Result validation / sanitization
// ============================================
function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asInt(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : fallback;
}

function sanitizeScopedLaws(
  raw: unknown,
  status: "in" | "out",
  validLawIds: ReadonlySet<string>,
  validPassageIdxs: ReadonlySet<number>,
): ScopedLaw[] {
  if (!Array.isArray(raw)) return [];
  const out: ScopedLaw[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const law_id = asString(r.law_id);
    if (!validLawIds.has(law_id)) continue;
    const reason = asString(r.reason).slice(0, 1000);
    if (!reason) continue;
    const passage_refs = Array.isArray(r.passage_refs)
      ? (r.passage_refs as unknown[])
          .map((p) => asInt(p, -1))
          .filter((n) => validPassageIdxs.has(n))
      : [];
    out.push({ law_id, status, reason, passage_refs });
  }
  return out;
}

function sanitizeNotes(raw: unknown): ConversationTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: ConversationTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const text = asString(r.text).trim();
    if (!text) continue;
    const role: ConversationRole = r.role === "user" ? "user" : "system";
    const kindRaw = asString(r.kind, "note");
    const kind: ConversationKind =
      kindRaw === "scope_update" || kindRaw === "note" || kindRaw === "question" || kindRaw === "answer"
        ? (kindRaw as ConversationKind)
        : "note";
    const refsRaw = r.refs && typeof r.refs === "object" ? (r.refs as Record<string, unknown>) : {};
    const refs: ConversationTurn["refs"] = {};
    if (typeof refsRaw.passage_idx === "number") refs.passage_idx = refsRaw.passage_idx;
    if (typeof refsRaw.law_id === "string") refs.law_id = refsRaw.law_id;
    if (typeof refsRaw.question_id === "string") refs.question_id = refsRaw.question_id;
    out.push({ role, kind, text: text.slice(0, 2000), refs });
  }
  return out;
}

function sanitizeQuestion(raw: RawScopingOutput["question"], maxPassageIdx: number): PendingQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const id = asString(raw.id).trim();
  const text = asString(raw.text).trim();
  if (!id || !text) return null;
  const fmtRaw = asString(raw.answer_format, "free_text");
  const answer_format: AnswerFormat =
    fmtRaw === "yes_no" || fmtRaw === "single_select" ? fmtRaw : "free_text";
  let options: string[] | null = null;
  if (answer_format === "single_select") {
    options = Array.isArray(raw.options)
      ? (raw.options as unknown[]).filter((o): o is string => typeof o === "string")
      : null;
    if (!options || options.length === 0) return null;
  }
  const askedIdx = asInt(raw.asked_at_passage_idx, 0);
  return {
    id: id.slice(0, 64),
    text: text.slice(0, 1000),
    context: asString(raw.context).slice(0, 1000),
    answer_format,
    options,
    asked_at_passage_idx: Math.min(Math.max(0, askedIdx), Math.max(0, maxPassageIdx)),
  };
}

// ============================================
// Public API
// ============================================
export async function runScopingTurn(
  llm: LLMAdapter,
  input: ScopingTurnInput,
): Promise<ScopingAction> {
  const validLawIds = new Set<string>([
    ...input.candidate_laws.map((l) => l.id),
    ...input.scope_in.map((s) => s.law_id),
    ...input.scope_out.map((s) => s.law_id),
  ]);
  const validPassageIdxs = new Set<number>(input.passages.map((p) => p.idx));
  const maxPassageIdx = input.passages.length > 0 ? input.passages.length - 1 : 0;

  const system = buildScopingSystem();
  const prompt = buildScopingPrompt(input);

  const response = await llm.complete({
    system,
    prompt,
    maxTokens: 1200,
    jsonMode: true,
  });
  const parsed = robustJsonParse<RawScopingOutput>(response.text);

  const action = asString(parsed?.action);
  const notes = sanitizeNotes(parsed?.notes);

  if (action === "ask") {
    const q = sanitizeQuestion(parsed.question, maxPassageIdx);
    if (!q) {
      log.error("scoping_agent.malformed_ask", { raw: parsed });
      return { kind: "done", notes };
    }
    return { kind: "ask", question: q, notes };
  }

  if (action === "commit") {
    const add_to_scope_in = sanitizeScopedLaws(parsed.add_to_scope_in, "in", validLawIds, validPassageIdxs);
    const add_to_scope_out = sanitizeScopedLaws(parsed.add_to_scope_out, "out", validLawIds, validPassageIdxs);
    const cursor_advance = Math.max(0, asInt(parsed.cursor_advance, 0));
    if (add_to_scope_in.length === 0 && add_to_scope_out.length === 0 && cursor_advance === 0) {
      // Empty commit = effectively a no-op. Treat as done so we don't loop.
      log.info("scoping_agent.empty_commit_to_done", {});
      return { kind: "done", notes };
    }
    return { kind: "commit", add_to_scope_in, add_to_scope_out, cursor_advance, notes };
  }

  if (action === "done") {
    return { kind: "done", notes };
  }

  log.error("scoping_agent.unknown_action", { action, raw: parsed });
  return { kind: "done", notes };
}
