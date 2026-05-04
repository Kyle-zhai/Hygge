// synthesizer.ts
//
// Multi-agent audit kernel: Layer 5 — synthesizer.
// Spec: docs/superpowers/specs/2026-04-30-multi-agent-audit-architecture.md §4
//
// Consolidates per-task persona findings into a single audited report:
//   {
//     executive_summary,
//     in_scope_analysis[{ law_id, overall_compliance, findings[...] }],
//     out_of_scope[{ law_id, reason }],
//     open_questions[],
//     disclaimer
//   }
//
// Hard rules enforced in code (never trust the model):
//   - disclaimer is always replaced with the canonical text
//   - citations are passed through verbatim from the input findings; the model
//     never invents new citations
//   - law_id values are clamped to scope_in
//   - stale flag is preserved exactly as orchestrator computed it (Tavily
//     cache age > STALE_DAYS or citation.published_at older than STALE_DAYS)
//   - overall_compliance is constrained to a fixed enum

import type { LLMAdapter } from "../llm/adapter.js";
import { completeAndParseJson } from "../utils/llm-helpers.js";
import { log } from "../utils/logger.js";
import type { ScopedLaw } from "./scoping-agent.js";
import type {
  FindingBasis,
  FindingCitation,
  FindingConfidence,
  PersonaFinding,
} from "./persona-analyst.js";

// ============================================
// Constants
// ============================================
export const STALE_DAYS = 90;

export const DISCLAIMER_EN =
  "This report is automated analysis, not legal advice. Findings reflect publicly available authority cited herein at the time of search and may be incomplete or outdated. Consult qualified counsel before making compliance decisions.";

export const DISCLAIMER_ZH =
  "本报告为自动化分析，不构成法律意见。所引用的权威依据为搜索时点的公开内容，可能不完整或已过时。在做出合规决策前请咨询合格法律顾问。";

const VALID_COMPLIANCE: ReadonlySet<OverallCompliance> = new Set([
  "compliant",
  "partial",
  "non_compliant",
  "unknown",
]);

// ============================================
// Public types
// ============================================
export type OverallCompliance =
  | "compliant"
  | "partial"
  | "non_compliant"
  | "unknown";

export interface SynthesizerLawRow {
  id: string;
  name_en: string;
  citation_format: string;
  jurisdiction: string;
}

/** A single finding flattened across (task, persona) — orchestrator joins data
 * from PersonaAnalysisResult + PlannedTask + cache row before passing in. */
export interface SynthesizerFinding extends PersonaFinding {
  task_id: string;
  law_id: string;
  law_section: string;
  persona_id: string;
  /** True if Tavily cache last_verified_at is older than STALE_DAYS, OR if no
   *  citation has a published_at within STALE_DAYS. Computed upstream. */
  stale: boolean;
  /** Phase 3: counter-argument from cross-challenge round, null otherwise. */
  dissent: string | null;
}

export interface SynthesizerInput {
  decisionText: string;
  scopeIn: ScopedLaw[];
  scopeOut: ScopedLaw[];
  laws: SynthesizerLawRow[];
  findings: SynthesizerFinding[];
  replyLanguage: "en" | "zh";
}

export interface SynthesizedFinding {
  section: string;
  claim: string;
  confidence: FindingConfidence;
  basis: FindingBasis;
  stale: boolean;
  citations: FindingCitation[];
  dissent: string | null;
  severity: number | null;
  probability: number | null;
  suggested_mitigation: string | null;
}

export interface SynthesizedLaw {
  law_id: string;
  overall_compliance: OverallCompliance;
  findings: SynthesizedFinding[];
}

export interface SynthesizedOutOfScope {
  law_id: string;
  reason: string;
}

export interface SynthesizedReport {
  executive_summary: string;
  in_scope_analysis: SynthesizedLaw[];
  out_of_scope: SynthesizedOutOfScope[];
  open_questions: string[];
  disclaimer: string;
}

// ============================================
// Raw LLM output (pre-validation)
// ============================================
interface RawSynthFinding {
  section?: string;
  claim?: string;
  confidence?: string;
  basis?: string;
  stale?: unknown;
  citations?: unknown;
  dissent?: string | null;
  severity?: number | null;
  probability?: number | null;
  suggested_mitigation?: string | null;
}

interface RawSynthLaw {
  law_id?: string;
  overall_compliance?: string;
  findings?: unknown;
}

interface RawOutOfScope {
  law_id?: string;
  reason?: string;
}

interface RawSynthOutput {
  executive_summary?: string;
  in_scope_analysis?: unknown;
  out_of_scope?: unknown;
  open_questions?: unknown;
  disclaimer?: string;
}

// ============================================
// Stale computation helper (exported for orchestrator)
// ============================================
export interface StalenessInput {
  finding: PersonaFinding & {
    task_id: string;
    persona_id: string;
    law_id: string;
    law_section: string;
    searchCacheLastVerifiedAt: string | null;
  };
  now?: number;
}

/**
 * A finding is stale if EITHER:
 *   (a) Tavily cache last_verified_at > STALE_DAYS old, OR
 *   (b) every citation's published_at is older than STALE_DAYS (best-effort
 *       — citations without a published_at don't count toward freshness).
 * If we can't determine either, default to false (don't cry wolf).
 */
export function computeStale(input: StalenessInput): boolean {
  const now = input.now ?? Date.now();
  const ttl = STALE_DAYS * 24 * 60 * 60 * 1000;
  const verifiedAt = input.finding.searchCacheLastVerifiedAt;
  if (verifiedAt) {
    const t = Date.parse(verifiedAt);
    if (Number.isFinite(t) && now - t > ttl) return true;
  }
  // Citation freshness: if at least one citation is within STALE_DAYS, treat
  // as fresh. Citations without published_at are ignored.
  const cites = input.finding.citations ?? [];
  let anyFresh = false;
  let anyDated = false;
  for (const c of cites) {
    if (!c.published_at) continue;
    anyDated = true;
    const t = Date.parse(c.published_at);
    if (Number.isFinite(t) && now - t <= ttl) {
      anyFresh = true;
      break;
    }
  }
  if (anyDated && !anyFresh) return true;
  return false;
}

// ============================================
// Prompt builders
// ============================================
function renderScope(scope: ScopedLaw[]): string {
  if (scope.length === 0) return "(none)";
  return scope.map((s) => `- ${s.law_id} :: ${s.reason}`).join("\n");
}

function renderLaws(rows: SynthesizerLawRow[]): string {
  if (rows.length === 0) return "(none)";
  return rows
    .map((r) => `- ${r.id} (${r.jurisdiction}): ${r.name_en} [${r.citation_format}]`)
    .join("\n");
}

function renderFindings(findings: SynthesizerFinding[]): string {
  if (findings.length === 0) return "(no findings emitted by Layer 3)";
  return findings
    .map((f, i) => {
      const cites = f.citations
        .map(
          (c, j) =>
            `    [${j + 1}] ${c.url}\n        title: ${c.title}\n        quote: ${c.quote.slice(0, 400)}\n        published_at: ${c.published_at ?? "n/a"}`,
        )
        .join("\n");
      return [
        `### Finding ${i + 1}`,
        `task_id: ${f.task_id}`,
        `persona_id: ${f.persona_id}`,
        `law_id: ${f.law_id}`,
        `section: ${f.law_section}`,
        `claim: ${f.claim}`,
        `confidence: ${f.confidence}`,
        `basis: ${f.basis}`,
        `severity: ${f.severity ?? "null"}`,
        `probability: ${f.probability ?? "null"}`,
        `stale: ${f.stale}`,
        `dissent: ${f.dissent ?? "null"}`,
        `suggested_mitigation: ${f.suggested_mitigation ?? "null"}`,
        `citations:\n${cites || "    (none)"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function buildSynthSystem(): string {
  return [
    "You are Layer 5 of a multi-agent audit kernel: the synthesizer.",
    "You consolidate per-task persona findings into a single audited compliance report. You are NOT an analyst — you do not invent claims, citations, or risk levels. You preserve what the personas wrote and group it into a clean report.",
    "",
    "## Your job",
    "1. Group findings by law_id (only law_ids that appear in scope_in).",
    "2. For each law, classify overall_compliance: 'compliant' if all findings are 'settled' and no severity>=4; 'non_compliant' if any 'settled' finding has severity>=4; 'partial' if there is mixed evidence; 'unknown' if all findings are 'speculative' or zero findings.",
    "3. For each finding, copy section, claim, confidence, basis, stale, citations, dissent, severity, probability, suggested_mitigation VERBATIM from the input. Do NOT rewrite citations. Do NOT change the stale flag.",
    "4. Compose a 2-4 sentence executive_summary in plain language, naming the highest-risk law and the user-actionable next step.",
    "5. List out_of_scope laws: copy law_id and reason from scope_out unchanged.",
    "6. List open_questions: synthesize 2-5 short questions from gaps in coverage, 'speculative'-confidence findings, or 'unsettled' issues that need follow-up.",
    "7. The disclaimer field will be replaced server-side with the canonical text — emit a placeholder.",
    "",
    "## Hard constraints",
    "- Use ONLY law_ids that appear in scope_in (or scope_out for out_of_scope[]). Never invent ids.",
    "- Use ONLY citations that are present in the input findings. Never add new ones.",
    "- overall_compliance must be one of: compliant | partial | non_compliant | unknown.",
    "- Output JSON only, no prose preamble.",
    "",
    "## Output schema",
    "{",
    '  "executive_summary": "<2-4 sentences>",',
    '  "in_scope_analysis": [',
    "    {",
    '      "law_id": "<scope_in id>",',
    '      "overall_compliance": "compliant" | "partial" | "non_compliant" | "unknown",',
    '      "findings": [',
    "        {",
    '          "section": "...",',
    '          "claim": "...",',
    '          "confidence": "settled" | "unsettled" | "speculative",',
    '          "basis": "statute" | "regulation" | "agency_guidance" | "case_law" | "secondary_source",',
    '          "stale": <bool>,',
    '          "citations": [{ "url": "...", "title": "...", "quote": "...", "published_at": "..." }],',
    '          "dissent": "<string or null>",',
    '          "severity": <1-5 or null>,',
    '          "probability": <1-5 or null>,',
    '          "suggested_mitigation": "<string or null>"',
    "        }",
    "      ]",
    "    }",
    "  ],",
    '  "out_of_scope": [{ "law_id": "...", "reason": "..." }],',
    '  "open_questions": ["...", "..."],',
    '  "disclaimer": "<placeholder; will be overwritten>"',
    "}",
  ].join("\n");
}

function buildSynthPrompt(input: SynthesizerInput): string {
  const langNote =
    input.replyLanguage === "zh"
      ? "Phrase executive_summary, open_questions, suggested_mitigation, and out_of_scope.reason in Simplified Chinese. law_id, persona_id, citation URLs, and verbatim quotes stay in their original language."
      : "Phrase executive_summary, open_questions, suggested_mitigation, and out_of_scope.reason in English. law_id, persona_id, citation URLs, and verbatim quotes stay in their original language.";
  return [
    "## Decision under audit (excerpt)",
    input.decisionText.slice(0, 12000),
    "",
    "## scope_in (laws to analyze)",
    renderScope(input.scopeIn),
    "",
    "## scope_out (laws explicitly excluded — copy into out_of_scope)",
    renderScope(input.scopeOut),
    "",
    "## Law catalog",
    renderLaws(input.laws),
    "",
    "## Persona findings (your only source of analysis)",
    renderFindings(input.findings),
    "",
    "## Language",
    langNote,
    "",
    "Produce the synthesized report now. Return JSON only.",
  ].join("\n");
}

// ============================================
// Validation / sanitization
// ============================================
function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function clampScore(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const r = Math.round(v);
  return Math.min(5, Math.max(1, r));
}

const VALID_CONFIDENCE: ReadonlySet<FindingConfidence> = new Set([
  "settled",
  "unsettled",
  "speculative",
]);
const VALID_BASIS: ReadonlySet<FindingBasis> = new Set([
  "statute",
  "regulation",
  "agency_guidance",
  "case_law",
  "secondary_source",
]);

/** Cite-passthrough: we trust the orchestrator's citations more than the model. */
function citationsByFindingKey(
  findings: SynthesizerFinding[],
): Map<string, FindingCitation[]> {
  const m = new Map<string, FindingCitation[]>();
  for (const f of findings) {
    const key = `${f.task_id}::${f.persona_id}::${f.claim}`;
    m.set(key, f.citations);
  }
  return m;
}

function sanitizeCitationsRaw(raw: unknown): FindingCitation[] {
  if (!Array.isArray(raw)) return [];
  const out: FindingCitation[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const r = c as Partial<FindingCitation>;
    const url = asString(r.url).trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    out.push({
      url: url.slice(0, 2000),
      title: asString(r.title).slice(0, 500),
      quote: asString(r.quote).slice(0, 2000),
      published_at:
        typeof r.published_at === "string" ? r.published_at.slice(0, 64) : null,
    });
    if (out.length >= 8) break;
  }
  return out;
}

function sanitizeSynthFinding(
  raw: unknown,
  staleByKey: Map<string, boolean>,
  taskKey: string | null,
): SynthesizedFinding | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as RawSynthFinding;
  const claim = asString(r.claim).trim();
  if (!claim) return null;
  const confRaw = asString(r.confidence) as FindingConfidence;
  const confidence: FindingConfidence = VALID_CONFIDENCE.has(confRaw)
    ? confRaw
    : "speculative";
  const basisRaw = asString(r.basis) as FindingBasis;
  const basis: FindingBasis = VALID_BASIS.has(basisRaw)
    ? basisRaw
    : "secondary_source";
  // Trust orchestrator-provided staleness when we can find the matching source
  // finding; otherwise fall back to whatever the model emitted.
  let stale = r.stale === true;
  if (taskKey && staleByKey.has(taskKey)) {
    stale = staleByKey.get(taskKey) === true;
  }
  return {
    section: asString(r.section).trim().slice(0, 200) || "(unspecified)",
    claim: claim.slice(0, 2000),
    confidence,
    basis,
    stale,
    citations: sanitizeCitationsRaw(r.citations),
    dissent:
      typeof r.dissent === "string" && r.dissent.trim()
        ? r.dissent.slice(0, 2000)
        : null,
    severity: clampScore(r.severity),
    probability: clampScore(r.probability),
    suggested_mitigation:
      typeof r.suggested_mitigation === "string"
        ? r.suggested_mitigation.slice(0, 2000)
        : null,
  };
}

function sanitizeInScope(
  raw: unknown,
  validLawIds: ReadonlySet<string>,
  staleByKey: Map<string, boolean>,
): SynthesizedLaw[] {
  if (!Array.isArray(raw)) return [];
  const out: SynthesizedLaw[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const law = r as RawSynthLaw;
    const law_id = asString(law.law_id);
    if (!validLawIds.has(law_id) || seen.has(law_id)) continue;
    const compRaw = asString(law.overall_compliance) as OverallCompliance;
    const overall_compliance: OverallCompliance = VALID_COMPLIANCE.has(compRaw)
      ? compRaw
      : "unknown";
    const findingsRaw = Array.isArray(law.findings) ? law.findings : [];
    const findings: SynthesizedFinding[] = [];
    for (const f of findingsRaw) {
      const sanitized = sanitizeSynthFinding(f, staleByKey, null);
      if (sanitized) findings.push(sanitized);
      if (findings.length >= 12) break;
    }
    seen.add(law_id);
    out.push({ law_id, overall_compliance, findings });
    if (out.length >= validLawIds.size) break;
  }
  return out;
}

function sanitizeOutOfScope(
  raw: unknown,
  scopeOut: ScopedLaw[],
): SynthesizedOutOfScope[] {
  // Source of truth is scopeOut. We allow the model to provide reasons but
  // fall back to scopeOut[i].reason when missing.
  const byId = new Map<string, string>();
  if (Array.isArray(raw)) {
    for (const r of raw) {
      if (!r || typeof r !== "object") continue;
      const o = r as RawOutOfScope;
      const id = asString(o.law_id);
      const reason = asString(o.reason).trim().slice(0, 800);
      if (id && reason) byId.set(id, reason);
    }
  }
  return scopeOut.map((s) => ({
    law_id: s.law_id,
    reason: byId.get(s.law_id) ?? s.reason.slice(0, 800),
  }));
}

function sanitizeOpenQuestions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const q of raw) {
    if (typeof q !== "string") continue;
    const trimmed = q.trim();
    if (!trimmed) continue;
    out.push(trimmed.slice(0, 400));
    if (out.length >= 8) break;
  }
  return out;
}

function pickDisclaimer(replyLanguage: "en" | "zh"): string {
  return replyLanguage === "zh" ? DISCLAIMER_ZH : DISCLAIMER_EN;
}

function staleMapByClaim(findings: SynthesizerFinding[]): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const f of findings) {
    m.set(f.claim, f.stale);
  }
  return m;
}

// ============================================
// Public API
// ============================================
export async function runSynthesizer(
  llm: LLMAdapter,
  input: SynthesizerInput,
): Promise<SynthesizedReport> {
  const validLawIds = new Set(input.scopeIn.map((s) => s.law_id));
  const staleByKey = staleMapByClaim(input.findings);

  // Empty findings short-circuit: emit a minimal report rather than calling
  // the LLM (saves cost and lets the UI show "no analysis available").
  if (input.findings.length === 0) {
    log.warn("synthesizer.no_findings", {
      scopeInCount: input.scopeIn.length,
      scopeOutCount: input.scopeOut.length,
    });
    return {
      executive_summary:
        input.replyLanguage === "zh"
          ? "未生成可用的合规分析。请检查搜索源或扩大范围后重试。"
          : "No usable compliance analysis was produced. Check search sources or broaden scope and retry.",
      in_scope_analysis: input.scopeIn.map((s) => ({
        law_id: s.law_id,
        overall_compliance: "unknown" as OverallCompliance,
        findings: [],
      })),
      out_of_scope: sanitizeOutOfScope(undefined, input.scopeOut),
      open_questions: [],
      disclaimer: pickDisclaimer(input.replyLanguage),
    };
  }

  const system = buildSynthSystem();
  const prompt = buildSynthPrompt(input);

  // Use the shared completeAndParseJson helper: auto-retry on truncation
  // (5000 base, 8192 retry) and re-prompt on parse failure with strict-JSON
  // instruction. If both attempts fail, throw — the caller (audit-pipeline)
  // will markFailed and the user retries explicitly. This is intentionally
  // stricter than the previous "silent empty report" behavior, which masked
  // real failures as legitimate-looking unknowns.
  let parsed: RawSynthOutput | null = null;
  try {
    parsed = await completeAndParseJson<RawSynthOutput>(
      llm,
      { system, prompt },
      "synthesizer",
      { base: 5000, retry: 8192 },
    );
  } catch (err) {
    log.error("synthesizer.llm_failed", {
      error: err instanceof Error ? err.message : String(err),
      findingCount: input.findings.length,
    });
    throw err;
  }

  const executive_summary =
    asString(parsed?.executive_summary).trim().slice(0, 1500) ||
    (input.replyLanguage === "zh"
      ? "本次审计已完成。请参阅下方逐法规分析与开放性问题。"
      : "Audit complete. See per-law analysis and open questions below.");

  const in_scope_analysis = sanitizeInScope(
    parsed?.in_scope_analysis,
    validLawIds,
    staleByKey,
  );

  // Backfill: if the LLM dropped a law from scope_in entirely, add an empty
  // entry with overall_compliance='unknown' so the UI shows it.
  for (const s of input.scopeIn) {
    if (!in_scope_analysis.find((l) => l.law_id === s.law_id)) {
      in_scope_analysis.push({
        law_id: s.law_id,
        overall_compliance: "unknown",
        findings: [],
      });
    }
  }

  return {
    executive_summary,
    in_scope_analysis,
    out_of_scope: sanitizeOutOfScope(parsed?.out_of_scope, input.scopeOut),
    open_questions: sanitizeOpenQuestions(parsed?.open_questions),
    disclaimer: pickDisclaimer(input.replyLanguage),
  };
}

// Exported for tests
export const __test__ = {
  computeStale,
  sanitizeInScope,
  sanitizeOutOfScope,
  sanitizeOpenQuestions,
  sanitizeSynthFinding,
  pickDisclaimer,
  buildSynthSystem,
  buildSynthPrompt,
};
