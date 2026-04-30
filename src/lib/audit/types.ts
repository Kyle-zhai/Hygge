export type AuditSessionStatus =
  | "pending"
  | "running"
  | "findings_ready"
  | "signed_off"
  | "archived"
  | "failed";

export type AuditFindingKind =
  | "risk"
  | "blind_spot"
  | "dissent"
  | "mitigation"
  | "no_risk";

export type AuditFindingDisposition =
  | "accept_mitigation"
  | "accept_residual"
  | "reject"
  | "defer";

export interface AuditTemplate {
  slug: string;
  name_en: string;
  name_zh: string;
  description_en: string;
  description_zh: string;
  regulation_refs: string[];
  default_persona_ids: string[];
  system_prompt_overlay: string;
  output_schema: Record<string, unknown>;
  display_order: number;
  is_active: boolean;
}

export interface AuditSession {
  id: string;
  user_id: string;
  workspace_id: string | null;
  template_slug: string;
  decision_text: string;
  decision_text_sha256: string;
  decision_meta: Record<string, unknown>;
  status: AuditSessionStatus;
  evaluation_id: string | null;
  signed_off_by: string | null;
  signed_off_at: string | null;
  signed_off_signature: string | null;
  audit_trail_head_hash: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AuditFinding {
  id: string;
  session_id: string;
  persona_id: string;
  finding_kind: AuditFindingKind;
  severity: number | null;
  probability: number | null;
  claim: string;
  evidence_refs: Array<{ kind: string; ref: string }>;
  suggested_mitigation: string | null;
  user_disposition: AuditFindingDisposition | null;
  user_disposition_note: string | null;
  user_disposition_at: string | null;
  display_order: number;
  created_at: string;
}

export interface AuditTrailEntry {
  id: string;
  session_id: string;
  seq: number;
  action: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  payload_sha256: string;
  prev_hash: string | null;
  this_hash: string;
  ts: string;
}

export interface AuditSignoff {
  id: string;
  session_id: string;
  actor_id: string;
  role: string;
  signature: string;
  email_confirmed_at: string | null;
  ip_hash: string | null;
  created_at: string;
}

export type DecisionUrgency = "low" | "medium" | "high";

export interface DecisionMeta {
  owner?: string;
  urgency?: DecisionUrgency;
  regulatory_scope?: string[];
  source_url?: string;
  source_filename?: string;
  language?: "en" | "zh";
}

export interface TemplateAutoMatchResult {
  primary_slug: string;
  alternates: string[];
  confidence: number;
}
