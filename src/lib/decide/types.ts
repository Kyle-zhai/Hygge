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

// Resolve a confirmation-card option's display label from its stable `id`.
// The worker writes locale-specific text into options[].label at the time
// the row was created, so a row written when the session was zh stays zh
// even if the user's UI locale flipped to en (or the worker's locale
// detection mis-fired). Map well-known ids to current-locale strings on
// the frontend so the chrome stays in sync with the page.
//
// `fallback` is the DB-stored label, used verbatim if the id isn't a
// well-known one (e.g., a future addition the frontend doesn't know yet).
export function resolveOptionLabel(
  id: string,
  fallback: string,
  locale: "en" | "zh",
): string {
  const labels = locale === "zh" ? MECHANISM_LABELS_ZH : MECHANISM_LABELS_EN;

  if (id === "start") return locale === "zh" ? "开始分析" : "Start analysis";
  if (id === "swap_personas") return locale === "zh" ? "换一组 personas" : "Swap personas";

  if (id.startsWith("drop_")) {
    const kind = id.slice("drop_".length) as MechanismKind;
    if (kind in labels) {
      return locale === "zh" ? `跳过 ${labels[kind]}` : `Skip ${labels[kind]}`;
    }
  }

  return fallback;
}

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
