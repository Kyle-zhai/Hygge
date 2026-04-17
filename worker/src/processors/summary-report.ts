import type { LLMAdapter } from "../llm/adapter.js";
import type { EvaluationScores, ProjectParsedData, TopicClassification } from "../types/evaluation.js";
import type { SummaryReport } from "../types/report.js";
import { robustJsonParse } from "../utils/json-parse.js";
import { buildSummaryReportPrompt, buildTopicSummaryReportPrompt } from "../prompts/summary-report.js";

function reconstructFromStrings(arr: string[], requiredKey: string): any[] {
  const objects: any[] = [];
  let current: any = null;
  for (const s of arr) {
    const colonIdx = s.indexOf(": ");
    if (colonIdx === -1) continue;
    const key = s.slice(0, colonIdx).trim();
    const value = s.slice(colonIdx + 2).trim();
    if (key === requiredKey) {
      if (current) objects.push(current);
      current = { [key]: value };
    } else if (current) {
      current[key] = value;
    }
  }
  if (current) objects.push(current);
  return objects;
}

function parseSupportingPersonas(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v) => typeof v === "string" && v.length > 0);
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.startsWith("[")) {
      try { const parsed = JSON.parse(trimmed); if (Array.isArray(parsed)) return parsed; } catch {}
    }
    return trimmed.split(/,\s*/).filter(Boolean);
  }
  return [];
}

// Some LLM outputs flatten the object — the `point` ends up containing the
// supporting_personas array as inline text. Strip that tail and recover the ids.
function cleanConsensusPoint(raw: any): any {
  if (!raw || typeof raw !== "object") return raw;
  const rawPoint = typeof raw.point === "string" ? raw.point : "";
  const existing = parseSupportingPersonas(raw.supporting_personas);
  const extracted: string[] = [];
  const cleaned = rawPoint
    .replace(/[,;]?\s*supporting[_ ]personas\s*:\s*\[([^\]]*)\]/gi, (_m: string, ids: string) => {
      ids.split(/[,\s]+/)
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean)
        .forEach((id) => extracted.push(id));
      return "";
    })
    .replace(/[\s,;]+$/, "")
    .trim();
  return {
    ...raw,
    point: cleaned,
    supporting_personas: existing.length > 0 ? existing : extracted,
  };
}

function toStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function normalizeIfFeasible(raw: any): { next_steps: string[]; optimizations: string[]; risks: string[] } {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    next_steps: toStringArray(src.next_steps),
    optimizations: toStringArray(src.optimizations),
    risks: toStringArray(src.risks),
  };
}

function normalizeIfNotFeasible(raw: any): { modifications: string[]; direction: string; priorities: string[]; reference_cases: string[] } {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    modifications: toStringArray(src.modifications),
    direction: typeof src.direction === "string" ? src.direction : "",
    priorities: toStringArray(src.priorities),
    reference_cases: toStringArray(src.reference_cases),
  };
}

const MIN_FEASIBILITY_ITEMS = 3;

type IfFeasible = { next_steps: string[]; optimizations: string[]; risks: string[] };
type IfNotFeasible = { modifications: string[]; direction: string; priorities: string[]; reference_cases: string[] };

function isFeasibleSparse(f: IfFeasible): boolean {
  return f.next_steps.length < MIN_FEASIBILITY_ITEMS
    || f.optimizations.length < MIN_FEASIBILITY_ITEMS
    || f.risks.length < MIN_FEASIBILITY_ITEMS;
}

function isNotFeasibleSparse(f: IfNotFeasible): boolean {
  return f.modifications.length < MIN_FEASIBILITY_ITEMS
    || f.direction.trim().length === 0
    || f.priorities.length < MIN_FEASIBILITY_ITEMS
    || f.reference_cases.length < MIN_FEASIBILITY_ITEMS;
}

async function backfillFeasibility(
  llm: LLMAdapter,
  project: ProjectParsedData,
  reviews: ReviewForSummary[],
  current: { if_feasible: IfFeasible; if_not_feasible: IfNotFeasible }
): Promise<{ if_feasible: IfFeasible; if_not_feasible: IfNotFeasible }> {
  const feasibleSparse = isFeasibleSparse(current.if_feasible);
  const notFeasibleSparse = isNotFeasibleSparse(current.if_not_feasible);
  if (!feasibleSparse && !notFeasibleSparse) return current;

  const reviewSnippets = reviews
    .map((r) => `### ${r.persona_name} (${r.persona_id})
Review: ${r.review_text.slice(0, 500)}
Strengths: ${r.strengths.join(", ")}
Weaknesses: ${r.weaknesses.join(", ")}`)
    .join("\n\n");

  const system = `You are filling in the feasibility scenarios for a discussion synthesis report. The main report came back with the feasibility sections too sparse. You must regenerate both paths with rigorous quality.

CONTENT QUALITY REQUIREMENTS (non-negotiable):
1. PERSONA VOICE — every item MUST open with attribution to a specific persona from the reviews below, then state the specific action/change. Format: "Following {PersonaName}'s concern that {exact concern}, {specific action tied to a named feature/goal}." or "Addressing {PersonaName}'s point about {X}, ...".
2. TIE TO THE SUBMISSION — reference the topic's actual name, described features, stated goals, target users, or named comparables by exact wording. Do not invent details not in the submission or reviews.
3. REAL-WORLD GROUNDING — name real companies/products/initiatives from your training knowledge (e.g., "Figma's browser-first pivot", "Superhuman's waitlist launch"). Only cite what you are confident is real. Do NOT fabricate studies, reports, or company histories.
4. NO PLATITUDES — banned: "improve marketing", "gather feedback", "iterate quickly", "build community", "refine messaging", "leverage synergies". If generic, rewrite or drop.
5. EACH array MUST contain AT LEAST 3 items. "direction" MUST be a non-empty 1-2 sentence pivot description.
6. BOTH paths (if_feasible AND if_not_feasible) must be fully populated regardless of which seems more viable. The user sees them side-by-side.

"if_feasible" = concrete moves if the topic IS pursued. "if_not_feasible" = what must change OR pivot to if the current form cannot succeed.

Respond in English. Respond ONLY with valid JSON matching:
{
  "if_feasible": {
    "next_steps": ["<'{PersonaName} argued X, so do specific action Y tied to named feature Z'>", "<...>", "<...>"],
    "optimizations": ["<'{PersonaName} flagged weakness X; refine feature Y by...'>", "<...>", "<...>"],
    "risks": ["<'{PersonaName}'s concern that X may play out as Y, specifically when...'>", "<...>", "<...>"]
  },
  "if_not_feasible": {
    "modifications": ["<'{PersonaName} raised blocker X; change Y to address it'>", "<...>", "<...>"],
    "direction": "<recommended pivot in 1-2 sentences — name a real analogous case if possible>",
    "priorities": ["<specific first move tied to a named gap or persona concern>", "<...>", "<...>"],
    "reference_cases": ["<Real named company/product (e.g., 'Slack's pivot from game dev') — one-line reason the analogy fits>", "<...>", "<...>"]
  }
}`;

  const prompt = `Topic: ${project.name}
Description: ${project.description}
Target Audience: ${project.target_users}
Goals: ${project.goals}

## Persona Reviews

${reviewSnippets}

Generate both feasibility paths. At least 3 concrete, persona-referenced items per array. "direction" must be non-empty.`;

  try {
    const response = await llm.complete({ system, prompt, maxTokens: 2048, jsonMode: true });
    const parsed: any = robustJsonParse(response.text);
    const refilledFeasible = normalizeIfFeasible(parsed.if_feasible);
    const refilledNotFeasible = normalizeIfNotFeasible(parsed.if_not_feasible);
    return {
      if_feasible: feasibleSparse && !isFeasibleSparse(refilledFeasible) ? refilledFeasible : current.if_feasible,
      if_not_feasible: notFeasibleSparse && !isNotFeasibleSparse(refilledNotFeasible) ? refilledNotFeasible : current.if_not_feasible,
    };
  } catch (e) {
    console.warn("[backfillFeasibility] Retry failed, keeping original:", (e as Error).message);
    return current;
  }
}

function normalizePersonaAnalysis(raw: any): any {
  if (!raw || typeof raw !== "object") return { entries: [], consensus: [], disagreements: [] };

  let entries: any[];
  if (Array.isArray(raw.entries) && raw.entries.length > 0 && typeof raw.entries[0] === "string") {
    entries = reconstructFromStrings(raw.entries, "persona_id");
    console.warn("[normalizePersonaAnalysis] Reconstructed entries from flat strings:", entries.length);
  } else {
    entries = Array.isArray(raw.entries)
      ? raw.entries.filter((e: any) => typeof e === "object" && e !== null && e.persona_id)
      : [];
  }

  let consensus: any[];
  if (Array.isArray(raw.consensus) && raw.consensus.length > 0 && typeof raw.consensus[0] === "string") {
    consensus = reconstructFromStrings(raw.consensus, "point");
  } else {
    consensus = Array.isArray(raw.consensus)
      ? raw.consensus.filter((c: any) => typeof c === "object" && c !== null && c.point)
      : [];
  }
  consensus = consensus.map((c: any) => cleanConsensusPoint({
    ...c,
    supporting_personas: parseSupportingPersonas(c.supporting_personas),
  }));

  let disagreements: any[];
  if (Array.isArray(raw.disagreements) && raw.disagreements.length > 0 && typeof raw.disagreements[0] === "string") {
    disagreements = reconstructFromStrings(raw.disagreements, "point");
  } else {
    disagreements = Array.isArray(raw.disagreements)
      ? raw.disagreements.filter((d: any) => typeof d === "object" && d !== null && (d.point || d.reason))
      : [];
  }
  disagreements = disagreements.map(cleanConsensusPoint);

  return { entries, consensus, disagreements };
}

export interface ReviewForSummary {
  persona_id: string;
  persona_name: string;
  scores: EvaluationScores;
  review_text: string;
  strengths: string[];
  weaknesses: string[];
  cited_references?: Array<{ claim: string; source?: string }> | null;
}

/** Generate topic-mode synthesis report with consensus_score, synthesis, debate_highlights. */
export async function generateTopicSummaryReport(
  llm: LLMAdapter,
  project: ProjectParsedData,
  reviews: ReviewForSummary[],
  rawInput: string,
  dimensions: TopicClassification["dimensions"]
): Promise<Omit<SummaryReport, "id" | "evaluation_id">> {
  const { system, prompt } = buildTopicSummaryReportPrompt(project, reviews, rawInput, dimensions);
  const response = await llm.complete({ system, prompt, maxTokens: 8192, jsonMode: true });
  let parsed: any;
  try {
    parsed = robustJsonParse(response.text);
  } catch (e) {
    console.error("[TopicSummary] JSON parse failed. Raw text (first 500 chars):", response.text.slice(0, 500));
    throw new Error(`Topic summary JSON parse failed: ${(e as Error).message}`);
  }
  const feasibility = await backfillFeasibility(llm, project, reviews, {
    if_feasible: normalizeIfFeasible(parsed.if_feasible),
    if_not_feasible: normalizeIfNotFeasible(parsed.if_not_feasible),
  });

  return {
    overall_score: 0,
    persona_analysis: normalizePersonaAnalysis(parsed.persona_analysis),
    multi_dimensional_analysis: parsed.multi_dimensional_analysis,
    goal_assessment: [],
    if_not_feasible: feasibility.if_not_feasible,
    if_feasible: feasibility.if_feasible,
    action_items: [],
    market_readiness: parsed.market_readiness,
    readiness_label_en: parsed.readiness_label_en,
    readiness_label_zh: parsed.readiness_label_zh,
    scenario_simulation: null,
    round_table_debate: null,
    opinion_drift: null,
    consensus_score: parsed.consensus_score,
    synthesis: parsed.synthesis,
    debate_highlights: parsed.debate_highlights,
    positions: parsed.positions ?? null,
    references: Array.isArray(parsed.references) ? parsed.references : null,
  };
}

/** Synthesize all persona perspectives into a comprehensive discussion summary. */
export async function generateSummaryReport(
  llm: LLMAdapter,
  project: ProjectParsedData,
  reviews: ReviewForSummary[],
  rawInput: string,
  dimensions?: TopicClassification["dimensions"]
): Promise<Omit<SummaryReport, "id" | "evaluation_id">> {
  const { system, prompt } = buildSummaryReportPrompt(project, reviews, rawInput, dimensions);
  const response = await llm.complete({ system, prompt, maxTokens: 8192, jsonMode: true });
  let parsed: any;
  try {
    parsed = robustJsonParse(response.text);
  } catch (e) {
    console.error("[SummaryReport] JSON parse failed. Raw text (first 500 chars):", response.text.slice(0, 500));
    throw new Error(`Summary report JSON parse failed: ${(e as Error).message}`);
  }
  const feasibility = await backfillFeasibility(llm, project, reviews, {
    if_feasible: normalizeIfFeasible(parsed.if_feasible),
    if_not_feasible: normalizeIfNotFeasible(parsed.if_not_feasible),
  });

  return {
    overall_score: parsed.overall_score,
    persona_analysis: normalizePersonaAnalysis(parsed.persona_analysis),
    multi_dimensional_analysis: parsed.multi_dimensional_analysis,
    goal_assessment: parsed.goal_assessment,
    if_not_feasible: feasibility.if_not_feasible,
    if_feasible: feasibility.if_feasible,
    action_items: parsed.action_items,
    market_readiness: parsed.market_readiness,
    readiness_label_en: parsed.readiness_label_en,
    readiness_label_zh: parsed.readiness_label_zh,
    scenario_simulation: null,
    round_table_debate: null,
    opinion_drift: null,
  };
}
