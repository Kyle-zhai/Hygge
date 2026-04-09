import type { LLMAdapter } from "../llm/adapter.js";
import type { EvaluationScores, ProjectParsedData } from "@shared/types/evaluation.js";
import type { SummaryReport } from "@shared/types/report.js";
import { buildSummaryReportPrompt } from "../prompts/summary-report.js";

export interface ReviewForSummary {
  persona_id: string;
  persona_name: string;
  scores: EvaluationScores;
  review_text: string;
  strengths: string[];
  weaknesses: string[];
}

/** Synthesize all persona perspectives into a comprehensive discussion summary. */
export async function generateSummaryReport(
  llm: LLMAdapter,
  project: ProjectParsedData,
  reviews: ReviewForSummary[],
  rawInput: string
): Promise<Omit<SummaryReport, "id" | "evaluation_id">> {
  const { system, prompt } = buildSummaryReportPrompt(project, reviews, rawInput);
  const response = await llm.complete({ system, prompt, maxTokens: 8192 });
  const parsed = JSON.parse(response.text);
  return {
    overall_score: parsed.overall_score,
    persona_analysis: parsed.persona_analysis,
    multi_dimensional_analysis: parsed.multi_dimensional_analysis,
    goal_assessment: parsed.goal_assessment,
    if_not_feasible: parsed.if_not_feasible,
    if_feasible: parsed.if_feasible,
    action_items: parsed.action_items,
    market_readiness: parsed.market_readiness,
    scenario_simulation: null,
  };
}
