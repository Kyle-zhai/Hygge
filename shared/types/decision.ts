// shared/types/decision.ts
// Single source of truth for the multi-agent decision analysis tool.
// Imported from both the Next.js app (src/) and the worker (worker/src/).
// Spec: docs/superpowers/specs/2026-05-06-multi-agent-decision-tool-design.md

export type DecisionType =
  | "tradeoff"
  | "build_or_kill"
  | "hire"
  | "pivot"
  | "feature_design"
  | "vendor_selection"
  | "other";

export type Dimension =
  | "technical"
  | "business"
  | "ux"
  | "strategic"
  | "people"
  | "finance";

export type MechanismKind =
  | "persona_review"
  | "round_table_debate"
  | "reflection_ranker"
  | "scenario_simulation"
  | "theory_of_mind"
  | "cross_challenge";

export type Timeline = "immediate" | "weeks" | "months" | "years";
export type Reversibility = "one_way_door" | "two_way_door" | "unknown";
export type Stakes = "low" | "medium" | "high" | "unknown";

export type SealedBy =
  | "all_required_filled"
  | "user_skip"
  | "budget_exhausted"
  | "auto_timeout";

export type BriefStatus =
  | "draft"
  | "finalized"
  | "invalidated"
  | "failed"
  | "partially_completed"
  | "completed";

export type MechanismRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type MessageKind =
  | "user_text"
  | "user_option"
  | "user_skip_run"
  | "agent_question"
  | "agent_confirmation"
  | "agent_thinking"
  | "agent_artifact"
  | "system";

// Source attribution for findings. "conflict_warning" is a synthetic source
// produced by reflection_ranker when two mechanisms reach contradictory
// conclusions on the same point.
export type FindingSource = MechanismKind | "conflict_warning";

// =====================================================================
// Routing extraction (Intake Agent output)
// =====================================================================

export interface ExtractedField<T> {
  value: T;
  /** 0 to 1. Threshold for "known" is 0.7. */
  confidence: number;
  /** Verbatim user-text quote that supports the value, or null if defaulted. */
  source_quote: string | null;
  /** True if the value came from a clarifying question, not from extraction. */
  was_asked: boolean;
}

export interface RoutingExtract {
  decision_type: ExtractedField<DecisionType>;
  primary_dimensions: ExtractedField<Dimension[]>;
  timeline: ExtractedField<Timeline>;
  reversibility: ExtractedField<Reversibility>;
  stakes: ExtractedField<Stakes>;
  stakeholders: ExtractedField<string[]>;
  /** User-named personas e.g. "I want a PM perspective". */
  persona_hints: ExtractedField<string[]>;
  alternatives: ExtractedField<string[]>;
  constraints: ExtractedField<string[]>;
}

// =====================================================================
// Mechanism configuration carried inside the Brief
// =====================================================================

export interface MechanismArgs {
  /** scenario_simulation: how far ahead to project. */
  time_horizon_months?: number;
  /** cross_challenge: explicit pairs of (proponent_id, challenger_id). */
  challenge_pairs?: [string, string][];
  /** theory_of_mind: which stakeholder to simulate. */
  stakeholder_to_simulate?: string;
  /** round_table_debate: number of debate rounds. */
  debate_rounds?: number;
}

export interface MechanismConfig {
  kind: MechanismKind;
  args: MechanismArgs;
}

// =====================================================================
// Question log (audit trail of intake conversation)
// =====================================================================

export interface QuestionOption {
  id: string;
  label: string;
  is_recommended: boolean;
}

export interface QuestionAnswer {
  kind: "option" | "free_text" | "skip_run_now";
  /** Option id, free-text content, or empty string for skip. */
  value: string;
}

export interface QuestionLogEntry {
  question_text: string;
  options: QuestionOption[] | null;
  answer: QuestionAnswer;
  /** Score that selected this question (info_gain × impact). */
  info_gain_score: number;
  asked_at: string;
}

// =====================================================================
// Brief — the immutable contract
// =====================================================================

export interface DecisionBrief {
  id: string;
  session_id: string;
  parent_brief_id: string | null;

  raw_user_messages: string[];
  /** LLM-cleaned single-sentence version of the user's question. */
  canonical_question: string;

  routing_extract: RoutingExtract;

  /** TEXT[] — must align with personas.id which is TEXT in prod. */
  persona_ids: string[];
  mechanisms: MechanismConfig[];

  question_log: QuestionLogEntry[];
  sealed_by: SealedBy | null;

  status: BriefStatus;
  llm_model: string | null;
  prompt_version: string | null;
  total_intake_tokens: number;
  extraction_confidence_avg: number | null;
  version: number;

  created_at: string;
  finalized_at: string | null;
}

// =====================================================================
// Mechanism run + findings
// =====================================================================

export interface MechanismRun {
  id: string;
  brief_id: string;
  kind: MechanismKind;
  status: MechanismRunStatus;
  args: MechanismArgs;
  /** Mechanism-specific raw output (transcript, scenarios, etc.). */
  raw_output: unknown;
  error_message: string | null;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
}

export interface Finding {
  id: string;
  brief_id: string;
  mechanism_run_id: string;
  source_mechanism: FindingSource;
  headline: string;
  /** 1 (info) to 5 (critical). */
  severity: 1 | 2 | 3 | 4 | 5;
  /** 0 to 1. */
  confidence: number;
  detail_summary: string;
  cited_persona_ids: string[];
  /** Order within the mechanism's section. */
  position: number | null;
  /** Stable id derived from headline + mechanism for UI reconcile. */
  content_hash: string;
  created_at: string;
}

// =====================================================================
// Mechanism processor output schema
// Each mechanism processor must emit findings conforming to this shape.
// =====================================================================

export interface MechanismFindingDraft {
  /** ≤ 80 chars; the one-line conclusion. */
  headline: string;
  severity: 1 | 2 | 3 | 4 | 5;
  /** 0 to 1. */
  confidence: number;
  /** ≤ 200 chars; what the mechanism saw to support this. */
  detail_summary: string;
  cited_persona_ids: string[];
}

export interface MechanismOutput {
  findings: MechanismFindingDraft[];
  /** Full transcript / scenarios / debate log for the drilldown UI. */
  raw_transcript: unknown;
}

// =====================================================================
// Sessions and chat messages
// =====================================================================

export interface DecisionSession {
  id: string;
  user_id: string;
  workspace_id: string | null;
  title: string | null;
  last_msg_at: string;
  created_at: string;
}

export interface DecisionMessage {
  id: string;
  session_id: string;
  kind: MessageKind;
  content: string | null;
  options: QuestionOption[] | null;
  brief_id: string | null;
  is_ephemeral: boolean;
  created_at: string;
}

// =====================================================================
// Defaults — used when routing fields can't be extracted and intake
// runs out of question budget.
// =====================================================================

export const DEFAULT_MECHANISMS: MechanismKind[] = [
  "persona_review",
  "reflection_ranker",
  "round_table_debate",
];

export const ALL_MECHANISMS: MechanismKind[] = [
  "persona_review",
  "round_table_debate",
  "scenario_simulation",
  "theory_of_mind",
  "cross_challenge",
  "reflection_ranker",
];

export const KNOWN_CONFIDENCE_THRESHOLD = 0.7;
export const MAX_INTAKE_QUESTIONS = 3;
export const SYNTHESIZER_DEBOUNCE_MS = 10_000;
export const MECHANISM_TIMEOUT_MS = 90_000;
export const BRIEF_TOTAL_TIMEOUT_MS = 5 * 60_000;
