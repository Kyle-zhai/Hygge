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
  consensus = consensus.map((c: any) => ({
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

  return { entries, consensus, disagreements };
}

export interface ReviewForSummary {
  persona_id: string;
  persona_name: string;
  scores: EvaluationScores;
  review_text: string;
  strengths: string[];
  weaknesses: string[];
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
  return {
    overall_score: 0,
    persona_analysis: normalizePersonaAnalysis(parsed.persona_analysis),
    multi_dimensional_analysis: parsed.multi_dimensional_analysis,
    goal_assessment: [],
    if_not_feasible: { modifications: [], direction: "", priorities: [], reference_cases: [] },
    if_feasible: { next_steps: [], optimizations: [], risks: [] },
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
  return {
    overall_score: parsed.overall_score,
    persona_analysis: normalizePersonaAnalysis(parsed.persona_analysis),
    multi_dimensional_analysis: parsed.multi_dimensional_analysis,
    goal_assessment: parsed.goal_assessment,
    if_not_feasible: parsed.if_not_feasible,
    if_feasible: parsed.if_feasible,
    action_items: parsed.action_items,
    market_readiness: parsed.market_readiness,
    readiness_label_en: parsed.readiness_label_en,
    readiness_label_zh: parsed.readiness_label_zh,
    scenario_simulation: null,
    round_table_debate: null,
    opinion_drift: null,
  };
}
