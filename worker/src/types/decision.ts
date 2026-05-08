// worker/src/types/decision.ts
// Worker-side copy of decision types. Mirrors shared/types/decision.ts.
// Worker tsconfig rootDir scopes compilation to worker/src/, so shared/ is
// not directly importable; we duplicate types here matching the pattern
// already used for persona.ts and evaluation.ts.

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

export type FindingSource = MechanismKind | "conflict_warning";

export interface ExtractedField<T> {
  value: T;
  confidence: number;
  source_quote: string | null;
  was_asked: boolean;
}

export interface RoutingExtract {
  decision_type: ExtractedField<DecisionType>;
  primary_dimensions: ExtractedField<Dimension[]>;
  timeline: ExtractedField<Timeline>;
  reversibility: ExtractedField<Reversibility>;
  stakes: ExtractedField<Stakes>;
  stakeholders: ExtractedField<string[]>;
  persona_hints: ExtractedField<string[]>;
  alternatives: ExtractedField<string[]>;
  constraints: ExtractedField<string[]>;
}

export interface MechanismArgs {
  time_horizon_months?: number;
  challenge_pairs?: [string, string][];
  stakeholder_to_simulate?: string;
  debate_rounds?: number;
}

export interface MechanismConfig {
  kind: MechanismKind;
  args: MechanismArgs;
}

export interface QuestionOption {
  id: string;
  label: string;
  is_recommended: boolean;
}

export interface QuestionAnswer {
  kind: "option" | "free_text" | "skip_run_now";
  value: string;
}

export interface QuestionLogEntry {
  question_text: string;
  options: QuestionOption[] | null;
  answer: QuestionAnswer;
  info_gain_score: number;
  asked_at: string;
}

export interface DecisionBrief {
  id: string;
  session_id: string;
  parent_brief_id: string | null;

  raw_user_messages: string[];
  canonical_question: string;

  routing_extract: RoutingExtract;

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

export interface MechanismRun {
  id: string;
  brief_id: string;
  kind: MechanismKind;
  status: MechanismRunStatus;
  args: MechanismArgs;
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
  severity: 1 | 2 | 3 | 4 | 5;
  confidence: number;
  detail_summary: string;
  cited_persona_ids: string[];
  position: number | null;
  content_hash: string;
  created_at: string;
}

// Evidence attached to a single finding. Replaces "trust the LLM's word"
// with explicit source provenance the UI can render as a chip. `kind`
// tells the UI what icon to draw; `text` is the short summary; `source`
// is a URL when web-search-grounded (Phase 3) and an empty string for
// LLM-internal reasoning.
export interface FindingEvidence {
  kind: "data_point" | "comparable" | "user_research" | "principle" | "expert_view";
  text: string;
  source?: string;
}

export interface MechanismFindingDraft {
  headline: string;
  severity: 1 | 2 | 3 | 4 | 5;
  confidence: number;
  detail_summary: string;
  cited_persona_ids: string[];
  evidence?: FindingEvidence[];
}

// Mechanism-specific structured view that the UI renders as the primary
// visualization. Each kind populates its own variant; consumers should
// branch on `kind` to render the appropriate component. This replaces
// the wall-of-text `raw_transcript` as the user-facing default.
export type MechanismView =
  | {
      kind: "persona_review";
      persona_takes: Array<{
        persona_id: string;
        stance: "supports" | "neutral" | "opposes";
        key_insight: string;
        surprising_angle?: string;
      }>;
    }
  | {
      kind: "round_table_debate";
      stance_matrix: Array<{
        persona_id: string;
        opening_stance: "supports" | "neutral" | "opposes";
        final_stance: "supports" | "neutral" | "opposes";
        shifted: boolean;
        key_argument: string;
      }>;
      pivotal_exchanges: Array<{
        from_persona_id: string;
        to_persona_id: string;
        summary: string;
      }>;
    }
  | {
      kind: "scenario_simulation";
      scenarios: Array<{
        name: string;
        probability_pct: number;
        impact: "low" | "medium" | "high" | "critical";
        narrative: string;
        leading_indicators: string[];
      }>;
    }
  | {
      kind: "theory_of_mind";
      stakeholder: string;
      what_they_optimize_for: string[];
      fears: string[];
      what_would_change_their_mind: string[];
    }
  | {
      kind: "cross_challenge";
      pairings: Array<{
        proponent_id: string;
        challenger_id: string;
        position: string;
        sharpest_counter: string;
        residual_uncertainty: string;
      }>;
    }
  | {
      kind: "reflection_ranker";
      finding_scores: Array<{
        finding_headline: string;
        evidence_strength: 1 | 2 | 3 | 4 | 5;
        missing_evidence: string;
      }>;
    };

export interface MechanismOutput {
  findings: MechanismFindingDraft[];
  // Primary structured view (Phase 2+). Optional for backward compat
  // with rows persisted before the structured-view migration.
  mechanism_view?: MechanismView;
  // Kept as fallback / debugging aid; UI hides this behind a collapsible
  // "Original transcript" affordance instead of using it as the default.
  raw_transcript: unknown;
}

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

// Default mechanisms routed when nothing more specific kicks in. Note:
// reflection_ranker is intentionally NOT here — it's the synthetic
// conflict-carrier the synthesizer creates internally on the final pass,
// not a real mechanism the orchestrator dispatches as a job.
export const DEFAULT_MECHANISMS: MechanismKind[] = [
  "persona_review",
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
export const MAX_FINDINGS_PER_MECHANISM = 30;

// Required fields for finalization (must reach KNOWN_CONFIDENCE_THRESHOLD)
export const REQUIRED_FIELDS = ["decision_type", "primary_dimensions"] as const;
