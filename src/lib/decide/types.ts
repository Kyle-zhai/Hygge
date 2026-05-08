// Frontend copy of the decision types. Mirrors shared/types/decision.ts
// and worker/src/types/decision.ts. Same duplication pattern used for
// persona / evaluation types in this repo.

export type DecisionType =
  | "tradeoff"
  | "build_or_kill"
  | "hire"
  | "pivot"
  | "feature_design"
  | "vendor_selection"
  | "other";

export type Dimension =
  | "technical" | "business" | "ux" | "strategic" | "people" | "finance";

export type MechanismKind =
  | "persona_review"
  | "round_table_debate"
  | "reflection_ranker"
  | "scenario_simulation"
  | "theory_of_mind"
  | "cross_challenge";

export type FindingSource = MechanismKind | "conflict_warning";

export type BriefStatus =
  | "draft" | "finalized" | "invalidated"
  | "failed" | "partially_completed" | "completed";

export type MessageKind =
  | "user_text" | "user_option" | "user_skip_run"
  | "agent_question" | "agent_confirmation" | "agent_thinking"
  | "agent_artifact" | "system";

export interface QuestionOption {
  id: string;
  label: string;
  is_recommended: boolean;
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

export interface DecisionBriefSummary {
  id: string;
  session_id: string;
  parent_brief_id: string | null;
  status: BriefStatus;
  decision_type: DecisionType | null;
  primary_dimensions: Dimension[];
  canonical_question: string;
  persona_ids: string[];
  mechanism_kinds: MechanismKind[];
  created_at: string;
  finalized_at: string | null;
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

export interface MechanismRunSummary {
  id: string;
  kind: MechanismKind;
  status: "queued" | "running" | "completed" | "failed" | "skipped";
  error_message: string | null;
  duration_ms: number | null;
}

export const MECHANISM_LABELS_EN: Record<MechanismKind, string> = {
  persona_review: "Persona review",
  round_table_debate: "Round-table debate",
  scenario_simulation: "Scenario simulation",
  theory_of_mind: "Theory of mind",
  cross_challenge: "Cross-challenge",
  reflection_ranker: "Reflection ranker",
};

export const MECHANISM_LABELS_ZH: Record<MechanismKind, string> = {
  persona_review: "Persona 各自分析",
  round_table_debate: "圆桌辩论",
  scenario_simulation: "场景模拟",
  theory_of_mind: "心智理论",
  cross_challenge: "交叉挑战",
  reflection_ranker: "反思排序",
};

export const MECHANISM_ICONS: Record<MechanismKind, string> = {
  persona_review: "👥",
  round_table_debate: "📐",
  scenario_simulation: "🔮",
  theory_of_mind: "🧠",
  cross_challenge: "⚔️",
  reflection_ranker: "📊",
};

// Canonical display order for previews (no DB roundtrip needed).
export const ALL_MECHANISMS_LIST: MechanismKind[] = [
  "persona_review",
  "round_table_debate",
  "scenario_simulation",
  "theory_of_mind",
  "cross_challenge",
  "reflection_ranker",
];
