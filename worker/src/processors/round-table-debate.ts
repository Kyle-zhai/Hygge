import type { LLMAdapter } from "../llm/adapter.js";
import type { Persona } from "../types/persona.js";
import type { RoundTableDebateResult, DebateRound } from "../types/report.js";
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
): Promise<RoundTableDebateResult> {
  const { system: selSys, prompt: selPrompt } = buildSelectionPrompt(personas, reviews);
  const selResponse = await llm.complete({ system: selSys, prompt: selPrompt, maxTokens: 512 });
  const selection = JSON.parse(selResponse.text);

  const selectedIds: string[] = selection.selected_persona_ids;
  const topicFocus: string = selection.topic_focus;
  const roundThemes: string[] = selection.round_themes || [topicFocus, "Counter-arguments", "Final positions"];

  const selectedPersonas = personas.filter((p) => selectedIds.includes(p.id));
  const selectedReviews = reviews.filter((r) => selectedIds.includes(r.persona_id));

  const rounds: DebateRound[] = [];
  const rawRounds: Array<{ round: number; messages: Array<{ persona_id: string; content: string }> }> = [];

  for (let i = 0; i < 3; i++) {
    const { system, prompt } = buildDebateRoundPrompt(
      i + 1,
      roundThemes[i] || topicFocus,
      selectedPersonas,
      selectedReviews,
      rawRounds,
    );
    const response = await llm.complete({ system, prompt, maxTokens: 2048 });
    const parsed = JSON.parse(response.text);

    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    rounds.push({ round: i + 1, theme: roundThemes[i] || topicFocus, messages });
    rawRounds.push({ round: i + 1, messages });
  }

  const { system: outSys, prompt: outPrompt } = buildOutcomePrompt(selectedPersonas, rawRounds);
  const outResponse = await llm.complete({ system: outSys, prompt: outPrompt, maxTokens: 1024 });
  const outcome = JSON.parse(outResponse.text);

  return {
    selected_persona_ids: selectedIds,
    topic_focus: topicFocus,
    rounds,
    outcome: {
      consensus_reached: outcome.consensus_reached ?? false,
      key_insights: outcome.key_insights ?? [],
      remaining_disagreements: outcome.remaining_disagreements ?? [],
    },
  };
}
