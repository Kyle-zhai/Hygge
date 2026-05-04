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
import { analyzeStanceDynamics } from "./stance-dynamics.js";
import { applyPassiveObservations, type SpeakerObservation } from "./passive-observation.js";
import {
  buildArgumentGraph,
  buildArgumentReflections,
  type DebateRoundForGraph,
} from "./argument-graph.js";
import type { ArgumentNode } from "../types/argument-graph.js";
import { loadProceduralMemoryByPersona } from "./procedural-memory.js";
import { parseToMEntries, persistToMState } from "./theory-of-mind.js";
import type { ToMState } from "../types/theory-of-mind.js";
import {
  parseMove,
  buildMoveHistogram,
  buildMoveReflections,
  type RoundForMoves,
} from "./rhetorical-moves.js";
import type { RhetoricalMove } from "../types/rhetorical-moves.js";
import { rankReflectionLines } from "./reflection-ranker.js";
import { scoreToMReads, buildToMCalibrationReflections } from "./tom-calibration.js";
import { detectReplyLanguageWeighted } from "./language-detect.js";

const ROUND_MAX_TOKENS = 4096;

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

async function persistArgumentNodes(nodes: ArgumentNode[]): Promise<void> {
  if (nodes.length === 0) return;
  const rows = nodes.map((n) => ({
    id: n.id,
    evaluation_id: n.evaluation_id,
    round: n.round,
    speaker: n.speaker,
    claim: n.claim,
    attacks: n.attacks,
    supports: n.supports,
  }));
  const { error } = await supabase.from("argument_nodes").upsert(rows, {
    onConflict: "id",
  });
  if (error) {
    log.warn("argument_nodes.persist_failed", {
      evaluationId: nodes[0].evaluation_id,
      count: nodes.length,
      error: error.message,
    });
  }
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
  // Detect reply language once from the user's most authoritative inputs:
  // the raw submission outweighs the parsed project fields because parsing
  // can drift in tone/phrasing. If the project text is mixed-language, the
  // raw input (what the user actually typed) wins.
  const replyLanguage = detectReplyLanguageWeighted([
    { text: rawInput, weight: 3 },
    { text: project.description, weight: 1 },
    { text: project.name, weight: 1 },
  ]);

  const { system: selSys, prompt: selPrompt } = buildSelectionPrompt(personas, reviews, project, replyLanguage);
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
    log.warn("debate.selection_fallback", {
      evaluationId,
      rawIdCount: rawIds.length,
      validBeforeFallback: validIds.length,
      fallback: "personas.slice(0, 4)",
    });
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
  const beliefHistory: Map<string, BeliefState[]> | undefined = evaluationId
    ? new Map<string, BeliefState[]>()
    : undefined;

  if (evaluationId && beliefStates && beliefHistory) {
    for (const review of selectedReviews) {
      const initial = deriveInitialBeliefState({
        evaluation_id: evaluationId,
        persona_id: review.persona_id,
        overall_stance: (review.overall_stance ?? null) as PersonaStance | null,
        strengths: review.strengths,
        weaknesses: review.weaknesses,
      });
      beliefStates.set(review.persona_id, initial);
      beliefHistory.set(review.persona_id, [initial]);
      await persistBeliefState(initial);
    }
  }

  const rounds: DebateRound[] = [];
  const rawRounds: Array<{ round: number; messages: Array<{ persona_id: string; content: string }> }> = [];

  const personaNameOf = (id: string): string => {
    return selectedPersonas.find((p) => p.id === id)?.identity?.name || id;
  };

  const proceduralMemory = evaluationId
    ? await loadProceduralMemoryByPersona(selectedPersonas.map((p) => p.id))
    : undefined;

  // ToM state: per-observer snapshot of what they thought every OTHER persona
  // believed at the END of the previous round. Carried INTO the next round's
  // prompt so personas can name explicit gaps when their prior read was wrong.
  const tomStates: Map<string, ToMState> | undefined = evaluationId
    ? new Map<string, ToMState>()
    : undefined;
  const validPersonaIdSet = new Set(selectedPersonas.map((p) => p.id));

  // Per-message rhetorical move history. Built up after each round and read by
  // the next round's reflection pass to flag persona ruts (monotone evasion,
  // missing concede/data/steelman across the debate).
  const moveRoundsHistory: RoundForMoves[] = [];

  // Per-round ToM snapshots so we can score calibration: an observer's ToM
  // read at end of round N is checked against targets' position changes
  // during round N+1. Only fires from round 3 onward.
  const tomHistory = new Map<number, Map<string, ToMState>>();

  for (let i = 0; i < 3; i++) {
    const upcomingRound = i + 1;
    const stanceLines = beliefHistory
      ? analyzeStanceDynamics(beliefHistory, upcomingRound).reflectionLines
      : [];
    const graphForReflection = evaluationId
      ? buildArgumentGraph(evaluationId, rawRounds satisfies DebateRoundForGraph[])
      : null;
    const argReflections = graphForReflection
      ? buildArgumentReflections(graphForReflection, upcomingRound, personaNameOf)
      : { unrespondedLines: [], cycleLines: [] };
    const moveLines = buildMoveReflections(
      buildMoveHistogram(moveRoundsHistory),
      upcomingRound,
      personaNameOf,
    );

    const calibrationLines: string[] = [];
    const priorToM = tomHistory.get(upcomingRound - 2);
    if (priorToM && beliefHistory) {
      const positionDeltas = new Map<string, number>();
      const prevIdx = upcomingRound - 2;
      const currIdx = upcomingRound - 1;
      for (const [personaId, history] of beliefHistory) {
        const before = history[prevIdx];
        const after = history[currIdx];
        if (before === undefined || after === undefined) continue;
        positionDeltas.set(personaId, Math.abs(after.position - before.position));
      }
      const scores = scoreToMReads(priorToM, positionDeltas);
      calibrationLines.push(...buildToMCalibrationReflections(scores, personaNameOf));
    }

    const reflectionLines = rankReflectionLines(
      [
        ...stanceLines,
        ...argReflections.unrespondedLines,
        ...argReflections.cycleLines,
        ...moveLines,
        ...calibrationLines,
      ],
      selectedPersonas.map((p) => p.identity?.name ?? p.id),
    );

    const { system, prompt } = buildDebateRoundPrompt(
      upcomingRound,
      roundThemes[i] || topicFocus,
      selectedPersonas,
      selectedReviews,
      rawRounds,
      project,
      rawInput,
      beliefStates,
      reflectionLines,
      proceduralMemory,
      tomStates,
      replyLanguage,
    );
    const response = await llm.complete({ system, prompt, maxTokens: ROUND_MAX_TOKENS, jsonMode: true });
    const parsed = robustJsonParse<Record<string, unknown>>(response.text);

    const messages = Array.isArray(parsed.messages)
      ? (parsed.messages as Array<Record<string, unknown>>)
      : [];
    if (!Array.isArray(parsed.messages)) {
      log.warn("debate.round_messages_missing", {
        evaluationId,
        round: upcomingRound,
        parsedKeys: Object.keys(parsed),
      });
    }

    const cleanedMessages = messages.map((m) => ({
      persona_id: typeof m.persona_id === "string" ? m.persona_id : "",
      content: typeof m.content === "string" ? m.content : "",
      responding_to: typeof m.responding_to === "string" ? m.responding_to : undefined,
      stance_shift: typeof m.stance_shift === "string" ? m.stance_shift : undefined,
    }));

    rounds.push({ round: upcomingRound, theme: roundThemes[i] || topicFocus, messages: cleanedMessages });
    rawRounds.push({ round: upcomingRound, messages: cleanedMessages });

    const moveMessages = messages
      .map((m) => ({
        persona_id: typeof m.persona_id === "string" ? m.persona_id : "",
        move: parseMove(m.rhetorical_move) as RhetoricalMove,
      }))
      .filter((m) => m.persona_id);
    moveRoundsHistory.push({ round: upcomingRound, messages: moveMessages });

    if (evaluationId) {
      const fullGraph = buildArgumentGraph(evaluationId, rawRounds satisfies DebateRoundForGraph[]);
      const newNodes = Array.from(fullGraph.nodes.values()).filter((n) => n.round === upcomingRound);
      await persistArgumentNodes(newNodes);
    }

    if (evaluationId && beliefStates && beliefHistory) {
      const speakerObservations: SpeakerObservation[] = [];
      const activeSpeakerIds = new Set<string>();

      for (const m of messages) {
        const personaId = typeof m.persona_id === "string" ? m.persona_id : null;
        if (!personaId) continue;

        if (tomStates) {
          const tomEntries = parseToMEntries(m.theory_of_mind, validPersonaIdSet)
            .filter((entry) => entry.about_persona_id !== personaId);
          if (tomEntries.length > 0) {
            const tomState: ToMState = {
              evaluation_id: evaluationId,
              observer_persona_id: personaId,
              round_number: upcomingRound,
              entries: tomEntries,
            };
            tomStates.set(personaId, tomState);
            await persistToMState(tomState);
          }
        }

        const prev = beliefStates.get(personaId);
        if (!prev) continue;
        const update = parseBeliefUpdate(m.belief_update);
        if (!update) continue;
        const next = applyBeliefUpdate(prev, update, upcomingRound);
        const deltaPos = next.position - prev.position;
        beliefStates.set(personaId, next);
        const hist = beliefHistory.get(personaId) ?? [];
        hist.push(next);
        beliefHistory.set(personaId, hist);
        activeSpeakerIds.add(personaId);
        speakerObservations.push({
          speakerId: personaId,
          delta_position: deltaPos,
          claim: update.shifted_because ?? "",
        });
        await persistBeliefState(next);
      }

      for (const [observerId, observerState] of beliefStates) {
        const passiveNext = applyPassiveObservations(observerState, speakerObservations, upcomingRound);
        if (passiveNext === observerState) continue;
        beliefStates.set(observerId, passiveNext);
        if (!activeSpeakerIds.has(observerId)) {
          const hist = beliefHistory.get(observerId) ?? [];
          hist.push(passiveNext);
          beliefHistory.set(observerId, hist);
        } else {
          const hist = beliefHistory.get(observerId) ?? [];
          if (hist.length > 0) hist[hist.length - 1] = passiveNext;
          beliefHistory.set(observerId, hist);
        }
        await persistBeliefState(passiveNext);
      }
    }

    if (tomStates && tomStates.size > 0) {
      const snapshot = new Map<string, ToMState>();
      for (const [observerId, state] of tomStates) {
        snapshot.set(observerId, { ...state, entries: state.entries.map((e) => ({ ...e })) });
      }
      tomHistory.set(upcomingRound, snapshot);
    }
  }

  const { system: outSys, prompt: outPrompt } = buildOutcomePrompt(selectedPersonas, rawRounds, project, replyLanguage);
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
