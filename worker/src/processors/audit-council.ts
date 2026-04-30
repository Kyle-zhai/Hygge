import type { Job } from "bullmq";
import { supabase } from "../supabase.js";
import { buildLLM, type LLMOverrides } from "../llm/factory.js";
import type { LLMAdapter } from "../llm/adapter.js";
import type { Persona } from "../types/persona.js";
import { robustJsonParse } from "../utils/json-parse.js";
import { log } from "../utils/logger.js";
import { appendAuditTrail } from "../audit/hash-chain.js";

export interface AuditJobData {
  auditSessionId: string;
  templateSlug: string;
  decisionText: string;
  decisionMeta: Record<string, unknown>;
  userId: string;
  workspaceId: string | null;
  llmOverrides?: LLMOverrides;
}

interface AuditTemplateRow {
  slug: string;
  name_en: string;
  name_zh: string;
  description_en: string;
  description_zh: string;
  default_persona_ids: string[];
  system_prompt_overlay: string;
  regulation_refs: string[];
}

type FindingKind = "risk" | "blind_spot" | "dissent" | "mitigation" | "no_risk";

interface RawFinding {
  finding_kind?: string;
  claim?: string;
  severity?: number | null;
  probability?: number | null;
  evidence?: string | null;
  suggested_mitigation?: string | null;
  affected_stakeholders?: string[];
  regulation_refs?: string[];
}

interface PersonaCouncilOutput {
  findings: RawFinding[];
}

const VALID_KINDS = new Set<FindingKind>(["risk", "blind_spot", "dissent", "mitigation", "no_risk"]);

export async function processAuditJob(job: Job<AuditJobData>): Promise<void> {
  const { auditSessionId, templateSlug, decisionText, decisionMeta, userId, llmOverrides } = job.data;
  const ctx = { auditSessionId, templateSlug, userId };
  log.info("audit.start", ctx);

  const llm = buildLLM(llmOverrides);

  const { data: template, error: templateErr } = await supabase
    .from("audit_templates")
    .select("*")
    .eq("slug", templateSlug)
    .maybeSingle();
  if (templateErr || !template) {
    throw new Error(`audit_templates lookup failed for ${templateSlug}: ${templateErr?.message ?? "not found"}`);
  }
  const tpl = template as AuditTemplateRow;

  const personaIds = tpl.default_persona_ids ?? [];
  if (personaIds.length === 0) {
    throw new Error(`audit template ${templateSlug} has no default_persona_ids`);
  }

  const { data: personaRows, error: personaErr } = await supabase
    .from("personas")
    .select("*")
    .in("id", personaIds);
  if (personaErr || !personaRows || personaRows.length === 0) {
    throw new Error(`personas lookup failed: ${personaErr?.message ?? "no personas matched"}`);
  }
  const personas = personaRows as Persona[];

  const allFindings: Array<RawFinding & { persona_id: string }> = [];
  let personaSuccessCount = 0;

  for (const persona of personas) {
    try {
      const result = await runPersonaCouncil(llm, persona, tpl, decisionText, decisionMeta);
      for (const f of result.findings) {
        allFindings.push({ ...f, persona_id: persona.id });
      }
      personaSuccessCount++;
    } catch (err) {
      log.error("audit.persona_failed", {
        ...ctx,
        personaId: persona.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const rows = allFindings.map((f, idx) => normalizeFinding(f, auditSessionId, idx));
  if (rows.length === 0) {
    throw new Error(
      `audit ${auditSessionId}: no findings produced (${personaSuccessCount}/${personas.length} personas succeeded, all returned empty arrays)`,
    );
  }

  const { error: insertErr } = await supabase.from("audit_findings").insert(rows);
  if (insertErr) {
    throw new Error(`audit_findings insert failed: ${insertErr.message}`);
  }

  await appendAuditTrail({
    sessionId: auditSessionId,
    action: "findings_generated",
    actorId: null,
    payload: {
      template_slug: templateSlug,
      persona_count: personas.length,
      finding_count: rows.length,
    },
  });

  const { error: statusErr } = await supabase
    .from("audit_sessions")
    .update({ status: "findings_ready" })
    .eq("id", auditSessionId);
  if (statusErr) {
    throw new Error(`audit_sessions status update failed: ${statusErr.message}`);
  }

  log.info("audit.complete", { ...ctx, findingCount: rows.length });
}

interface PersonaCouncilResult {
  findings: RawFinding[];
}

async function runPersonaCouncil(
  llm: LLMAdapter,
  persona: Persona,
  template: AuditTemplateRow,
  decisionText: string,
  decisionMeta: Record<string, unknown>,
): Promise<PersonaCouncilResult> {
  const system = buildAuditSystemPrompt(persona, template);
  const prompt = buildAuditPrompt(decisionText, decisionMeta);

  const response = await llm.complete({ system, prompt, maxTokens: 2048, jsonMode: true });
  const parsed = robustJsonParse<PersonaCouncilOutput>(response.text);
  const findings = Array.isArray(parsed?.findings) ? parsed.findings : [];

  return { findings };
}

function buildAuditSystemPrompt(persona: Persona, template: AuditTemplateRow): string {
  const personaName = persona.identity?.name ?? persona.id;
  const personaPrompt = persona.system_prompt ?? "";
  return [
    `You are ${personaName}, serving on a Decision Audit Council.`,
    "",
    personaPrompt,
    "",
    "## Council overlay (template-specific)",
    template.system_prompt_overlay,
    "",
    "## Adversarial rules (mandatory)",
    "1. Surface failure modes BEFORE any positive observation.",
    "2. Tag every finding with [sev=N prob=N] where N is 1-5 (severity × probability).",
    "3. NEVER form consensus with other council members. Disagreement is the point.",
    "4. If you find no risk in your area of expertise, you must still output a `no_risk` finding with an explicit justification stating WHY this decision is safe from your perspective.",
    "5. Cite specific phrases from the decision text in your `evidence` field.",
    "",
    "## Output format",
    "Return ONLY a JSON object matching this shape:",
    "{",
    "  \"findings\": [",
    "    {",
    "      \"finding_kind\": \"risk\" | \"blind_spot\" | \"dissent\" | \"mitigation\" | \"no_risk\",",
    "      \"claim\": \"<one-sentence statement of the finding>\",",
    "      \"severity\": <1-5 or null for mitigation/no_risk>,",
    "      \"probability\": <1-5 or null for mitigation/no_risk>,",
    "      \"evidence\": \"<verbatim phrase from the decision text, or null>\",",
    "      \"suggested_mitigation\": \"<actionable mitigation, or null>\",",
    "      \"affected_stakeholders\": [\"<group>\", ...],",
    "      \"regulation_refs\": [\"<e.g., EU AI Act Art. 14>\", ...]",
    "    }",
    "  ]",
    "}",
    "",
    "Aim for 2-5 findings. Concise, specific, adversarial.",
  ].join("\n");
}

function buildAuditPrompt(decisionText: string, decisionMeta: Record<string, unknown>): string {
  const parts: string[] = ["## Decision under audit", "", decisionText];
  const owner = typeof decisionMeta.owner === "string" ? decisionMeta.owner.trim() : "";
  const urgency = typeof decisionMeta.urgency === "string" ? decisionMeta.urgency.trim() : "";
  if (owner || urgency) {
    parts.push("", "## Context");
    if (owner) parts.push(`- Owner: ${owner}`);
    if (urgency) parts.push(`- Urgency: ${urgency}`);
  }
  parts.push(
    "",
    "Audit this decision now. Surface every failure mode you can defend with evidence from the text.",
  );
  return parts.join("\n");
}

export function normalizeFinding(
  raw: RawFinding & { persona_id: string },
  sessionId: string,
  displayOrder: number,
) {
  const kind = VALID_KINDS.has(raw.finding_kind as FindingKind) ? (raw.finding_kind as FindingKind) : "risk";
  const claim = typeof raw.claim === "string" && raw.claim.trim() ? raw.claim.trim().slice(0, 2000) : "(no claim)";
  const severity = clampScore(raw.severity);
  const probability = clampScore(raw.probability);
  const isQualitativeKind = kind === "mitigation" || kind === "no_risk";

  const evidenceRefs: Array<Record<string, unknown>> = [];
  if (typeof raw.evidence === "string" && raw.evidence.trim()) {
    evidenceRefs.push({ kind: "phrase", text: raw.evidence.slice(0, 2000) });
  }
  const stakeholders = Array.isArray(raw.affected_stakeholders)
    ? raw.affected_stakeholders.filter((s): s is string => typeof s === "string").slice(0, 10)
    : [];
  if (stakeholders.length > 0) {
    evidenceRefs.push({ kind: "affected_stakeholders", values: stakeholders });
  }
  const regulationRefs = Array.isArray(raw.regulation_refs)
    ? raw.regulation_refs.filter((s): s is string => typeof s === "string").slice(0, 10)
    : [];
  if (regulationRefs.length > 0) {
    evidenceRefs.push({ kind: "regulation_refs", values: regulationRefs });
  }

  return {
    session_id: sessionId,
    persona_id: raw.persona_id,
    finding_kind: kind,
    claim,
    severity: isQualitativeKind ? null : severity,
    probability: isQualitativeKind ? null : probability,
    evidence_refs: evidenceRefs,
    suggested_mitigation:
      typeof raw.suggested_mitigation === "string" ? raw.suggested_mitigation.slice(0, 2000) : null,
    display_order: displayOrder,
  };
}

export function clampScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded;
}
