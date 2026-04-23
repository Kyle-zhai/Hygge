import type { LLMAdapter } from "../llm/adapter.js";
import type { Persona } from "../types/persona.js";
import type { ProjectParsedData } from "../types/evaluation.js";
import type { RoundTableDebateResult, DebateRound } from "../types/report.js";
import { robustJsonParse } from "../utils/json-parse.js";
import {
  buildSelectionPrompt,
  buildDebateRoundPrompt,
  buildOutcomePrompt,
  type ReviewForDebate,
} from "../prompts/round-table-debate.js";

export async function runRoundTableDebate(
  llm: LLMAdapter,
  personas: Persona[],
  reviews: ReviewForDebate[],
  project: ProjectParsedData,
  rawInput: string,
): Promise<RoundTableDebateResult> {
  const { system: selSys, prompt: selPrompt } = buildSelectionPrompt(personas, reviews, project);
  const selResponse = await llm.complete({ system: selSys, prompt: selPrompt, maxTokens: 512, jsonMode: true });
  const selection = robustJsonParse<Record<string, unknown>>(selResponse.text);

  const rawIds: string[] = Array.isArray(selection.selected_persona_ids) ? (selection.selected_persona_ids as string[]) : [];
  let validIds = rawIds.filter((id) => personas.some((p) => p.id === id));
  if (validIds.length < 2) {
    const nameMatched = rawIds
      .map((id) => personas.find((p) => p.identity?.name === id)?.id)
      .filter((id): id is string => !!id);
    validIds = Array.from(new Set([...validIds, ...nameMatched]));
  }
  if (validIds.length < 2) {
    validIds = personas.slice(0, Math.min(personas.length, 4)).map((p) => p.id);
  }
  if (validIds.length < 2) throw new Error(`Debate selection returned ${validIds.length} valid personas (need ≥2)`);

  const topicFocus: string = typeof selection.topic_focus === "string" ? selection.topic_focus : "";
  const roundThemes: string[] = Array.isArray(selection.round_themes)
    ? (selection.round_themes as string[])
    : [topicFocus, "Counter-arguments", "Final positions"];

  const selectedPersonas = personas.filter((p) => validIds.includes(p.id));
  const selectedReviews = reviews.filter((r) => validIds.includes(r.persona_id));

  const rounds: DebateRound[] = [];
  const rawRounds: Array<{ round: number; messages: Array<{ persona_id: string; content: string }> }> = [];

  for (let i = 0; i < 3; i++) {
    const { system, prompt } = buildDebateRoundPrompt(
      i + 1,
      roundThemes[i] || topicFocus,
      selectedPersonas,
      selectedReviews,
      rawRounds,
      project,
      rawInput,
    );
    const response = await llm.complete({ system, prompt, maxTokens: 2048, jsonMode: true });
    const parsed = robustJsonParse<Record<string, unknown>>(response.text);

    const messages = Array.isArray(parsed.messages)
      ? (parsed.messages as Array<{ persona_id: string; content: string }>)
      : [];
    rounds.push({ round: i + 1, theme: roundThemes[i] || topicFocus, messages });
    rawRounds.push({ round: i + 1, messages });
  }

  const { system: outSys, prompt: outPrompt } = buildOutcomePrompt(selectedPersonas, rawRounds, project);
  const outResponse = await llm.complete({ system: outSys, prompt: outPrompt, maxTokens: 1024, jsonMode: true });
  const outcome = robustJsonParse<Record<string, unknown>>(outResponse.text);

  return {
    selected_persona_ids: validIds,
    topic_focus: topicFocus,
    rounds,
    outcome: {
      consensus_reached: typeof outcome.consensus_reached === "boolean" ? outcome.consensus_reached : false,
      key_insights: Array.isArray(outcome.key_insights) ? (outcome.key_insights as string[]) : [],
      remaining_disagreements: Array.isArray(outcome.remaining_disagreements) ? (outcome.remaining_disagreements as string[]) : [],
    },
  };
}
