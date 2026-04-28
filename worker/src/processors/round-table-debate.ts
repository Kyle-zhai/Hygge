import type { LLMAdapter } from "../llm/adapter.js";
import type { Persona } from "../types/persona.js";
import type { ProjectParsedData, PersonaStance } from "../types/evaluation.js";
import type { RoundTableDebateResult, DebateRound } from "../types/report.js";
import {
  type BeliefState,
  type BeliefUpdate,
  applyBeliefUpdate,
  deriveInitialBeliefState,
} from "../types/belief-state.js";
import { robustJsonParse } from "../utils/json-parse.js";
import { supabase } from "../supabase.js";
import { log } from "../utils/logger.js";
import {
  buildSelectionPrompt,
  buildDebateRoundPrompt,
  buildOutcomePrompt,
  type ReviewForDebate,
} from "../prompts/round-table-debate.js";

const ROUND_MAX_TOKENS = 3072;

export function parseBeliefUpdate(raw: unknown): BeliefUpdate | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const newPos = typeof obj.new_position === "number" ? obj.new_position : null;
  const newConf = typeof obj.new_confidence === "number" ? obj.new_confidence : null;
  if (newPos === null || newConf === null) return null;
  const shifted = typeof obj.shifted_because === "string" ? obj.shifted_because : null;
  return {
    new_position: newPos,
    new_confidence: newConf,
    shifted_because: shifted,
  };
}

async function persistBeliefState(state: BeliefState): Promise<void> {
  const { error } = await supabase.from("persona_belief_states").upsert(
    {
      evaluation_id: state.evaluation_id,
      persona_id: state.persona_id,
      round_number: state.round_number,
      position: state.position,
      confidence: state.confidence,
      key_evidence: state.key_evidence,
      considered_alternatives: state.considered_alternatives,
      shifts_this_round: state.shifts_this_round,
    },
    { onConflict: "evaluation_id,persona_id,round_number" },
  );
  if (error) {
    log.warn("belief_state.persist_failed", {
      evaluationId: state.evaluation_id,
      personaId: state.persona_id,
      round: state.round_number,
      error: error.message,
    });
  }
}

export async function runRoundTableDebate(
  llm: LLMAdapter,
  personas: Persona[],
  reviews: ReviewForDebate[],
  project: ProjectParsedData,
  rawInput: string,
  evaluationId?: string,
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

  // Belief states are only populated when we have an evaluationId (i.e. a real
  // run, not an ad-hoc test). When undefined, we skip persistence and prompt
  // injection — debate degrades to its prior behavior.
  const beliefStates: Map<string, BeliefState> | undefined = evaluationId
    ? new Map<string, BeliefState>()
    : undefined;

  if (evaluationId && beliefStates) {
    for (const review of selectedReviews) {
      const initial = deriveInitialBeliefState({
        evaluation_id: evaluationId,
        persona_id: review.persona_id,
        overall_stance: (review.overall_stance ?? null) as PersonaStance | null,
        strengths: review.strengths,
        weaknesses: review.weaknesses,
      });
      beliefStates.set(review.persona_id, initial);
      await persistBeliefState(initial);
    }
  }

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
      beliefStates,
    );
    const response = await llm.complete({ system, prompt, maxTokens: ROUND_MAX_TOKENS, jsonMode: true });
    const parsed = robustJsonParse<Record<string, unknown>>(response.text);

    const messages = Array.isArray(parsed.messages)
      ? (parsed.messages as Array<Record<string, unknown>>)
      : [];

    const cleanedMessages = messages.map((m) => ({
      persona_id: typeof m.persona_id === "string" ? m.persona_id : "",
      content: typeof m.content === "string" ? m.content : "",
      responding_to: typeof m.responding_to === "string" ? m.responding_to : undefined,
      stance_shift: typeof m.stance_shift === "string" ? m.stance_shift : undefined,
    }));

    rounds.push({ round: i + 1, theme: roundThemes[i] || topicFocus, messages: cleanedMessages });
    rawRounds.push({ round: i + 1, messages: cleanedMessages });

    if (evaluationId && beliefStates) {
      for (const m of messages) {
        const personaId = typeof m.persona_id === "string" ? m.persona_id : null;
        if (!personaId) continue;
        const prev = beliefStates.get(personaId);
        if (!prev) continue;
        const update = parseBeliefUpdate(m.belief_update);
        if (!update) continue;
        const next = applyBeliefUpdate(prev, update, i + 1);
        beliefStates.set(personaId, next);
        await persistBeliefState(next);
      }
    }
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
