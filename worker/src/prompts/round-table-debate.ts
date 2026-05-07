import type { Persona } from "../types/persona.js";
import type { EvaluationScores, ProjectParsedData } from "../types/evaluation.js";
import type { BeliefState } from "../types/belief-state.js";
import type { ToMState } from "../types/theory-of-mind.js";
import { buildPriorToMBlock, buildToMSchemaField } from "../processors/theory-of-mind.js";
import { buildMoveSchemaField } from "../processors/rhetorical-moves.js";
import { replyLanguageDirective, type ReplyLanguage } from "../processors/language-detect.js";

export interface ReviewForDebate {
  persona_id: string;
  persona_name: string;
  scores: EvaluationScores | Record<string, string>;
  review_text: string;
  strengths: string[];
  weaknesses: string[];
  overall_stance?: string | null;
}

function formatPosition(position: number): string {
  if (position >= 0.6) return "strongly support";
  if (position >= 0.2) return "lean support";
  if (position > -0.2) return "neutral / undecided";
  if (position > -0.6) return "lean against";
  return "strongly against";
}

function buildBeliefStateLine(state: BeliefState | undefined): string {
  if (!state) return "";
  const positionLabel = formatPosition(state.position);
  const confPct = Math.round(state.confidence * 100);
  let line = `Current belief: ${positionLabel} (position ${state.position.toFixed(2)}, confidence ${confPct}%).`;
  if (state.shifts_this_round.length > 0) {
    const lastShift = state.shifts_this_round[0];
    const direction = lastShift.delta_position > 0 ? "moved you toward support" : lastShift.delta_position < 0 ? "moved you toward opposition" : "shook your confidence";
    line += ` Last round: ${lastShift.caused_by} ${direction} (Δposition ${lastShift.delta_position.toFixed(2)}).`;
  }
  return line;
}

function buildSystem(replyLanguage: ReplyLanguage): string {
  return `You are orchestrating a round-table debate between AI personas. Each persona has distinct values, biases, and communication styles defined by their profiles. Generate authentic responses that reflect each persona's psychology, not generic arguments.

The debate must be anchored in the specific topic submitted by the user — every argument should reference concrete elements of that topic (named features, numbers, claims, phrases, stakeholders) rather than abstract positions.

${replyLanguageDirective(replyLanguage)}
Output valid JSON only.`;
}

function buildTopicBlock(project: ProjectParsedData): string {
  return `**Topic:** ${project.name}
**Description:** ${project.description}
**Target Audience / Stakeholders:** ${project.target_users}
**Alternatives / Comparables:** ${project.competitors}
**Goals:** ${project.goals}
**Success Metrics:** ${project.success_metrics}`;
}

export function buildSelectionPrompt(
  personas: Persona[],
  reviews: ReviewForDebate[],
  project: ProjectParsedData,
  replyLanguage: ReplyLanguage = "en",
): { system: string; prompt: string } {
  const reviewSummaries = reviews.map((r) => {
    const stanceInfo = r.overall_stance ? ` (stance: ${r.overall_stance})` : "";
    return `- ${r.persona_name}${stanceInfo}: ${r.review_text.slice(0, 400)}`;
  }).join("\n");

  const prompt = `A user submitted the following topic for discussion. Several personas have reviewed it. Your job is to select 4-6 personas whose views are the MOST DIVERGENT on this specific topic and identify the core disagreement that would produce the most productive debate.

${buildTopicBlock(project)}

Reviews:
${reviewSummaries}

Selection rules:
- Prioritize clashing stances and clashing reasoning, not just clashing scores.
- The "topic_focus" must name a specific tension rooted in this topic (not a generic frame like "whether it will succeed"). Quote a phrase from the user's submission or a reviewer when possible.
- Each "round_themes" entry must be grounded in the actual topic — name a specific feature, claim, audience, or mechanism from the submission.

Respond with JSON:
{
  "selected_persona_ids": ["id1", "id2", ...],
  "topic_focus": "<the core disagreement or tension to debate, 1 sentence, rooted in a specific element of this topic>",
  "round_themes": ["<round 1 focus — grounded in the topic>", "<round 2 focus>", "<round 3 focus>"]
}

Available persona IDs: ${personas.map((p) => p.id).join(", ")}`;

  return { system: buildSystem(replyLanguage), prompt };
}

export function buildDebateRoundPrompt(
  roundNumber: number,
  theme: string,
  selectedPersonas: Persona[],
  reviews: ReviewForDebate[],
  previousRounds: Array<{ round: number; messages: Array<{ persona_id: string; content: string }> }>,
  project: ProjectParsedData,
  rawInput: string,
  beliefStates?: Map<string, BeliefState>,
  reflectionLines?: string[],
  // Procedural memory was an audit-era feature, removed in the 2026-05-06
  // reverse pivot. Argument retained as `undefined`-only for callsite
  // backward compatibility — drop it on the next refactor pass.
  proceduralMemory?: undefined,
  tomStates?: Map<string, ToMState>,
  replyLanguage: ReplyLanguage = "en",
): { system: string; prompt: string } {
  const personaNameOf = (id: string): string =>
    selectedPersonas.find((sp) => sp.id === id)?.identity?.name || id;
  const latestPositionByPersona = beliefStates
    ? new Map(Array.from(beliefStates.entries()).map(([id, state]) => [id, state.position]))
    : undefined;

  const personaProfiles = selectedPersonas.map((p) => {
    const review = reviews.find((r) => r.persona_id === p.id);
    const strengths = review?.strengths?.length ? review.strengths.slice(0, 3).join("; ") : "(none noted)";
    const weaknesses = review?.weaknesses?.length ? review.weaknesses.slice(0, 3).join("; ") : "(none noted)";
    const beliefLine = buildBeliefStateLine(beliefStates?.get(p.id));
    void proceduralMemory; // removed in 2026-05-06 reverse pivot
    const memoryBlock = "";
    const priorToM = tomStates?.get(p.id);
    const tomBlockText = priorToM
      ? buildPriorToMBlock(p.id, priorToM, personaNameOf, latestPositionByPersona)
      : "";
    const tomBlock = tomBlockText ? `\n${tomBlockText}` : "";
    return `[${p.id}] ${p.identity.name} — ${p.demographics.occupation}
Psychology: ${p.psychology?.personality_type ?? "analytical"}, decision style: ${p.psychology?.decision_making?.style ?? "balanced"}
Stance: ${review?.overall_stance || "N/A"}
Their review (initial position):
${review?.review_text.slice(0, 600) || "N/A"}
Strengths they noted: ${strengths}
Weaknesses they noted: ${weaknesses}${beliefLine ? `\n${beliefLine}` : ""}${memoryBlock}${tomBlock}`;
  }).join("\n\n");

  let context = "";
  if (previousRounds.length > 0) {
    context = "\n\nPrevious rounds:\n" + previousRounds.map((r) =>
      `--- Round ${r.round} ---\n` + r.messages.map((m) => {
        const name = selectedPersonas.find((p) => p.id === m.persona_id)?.identity.name || m.persona_id;
        return `${name}: ${m.content}`;
      }).join("\n")
    ).join("\n\n");
  }

  const rawInputExcerpt = rawInput.length > 1200 ? rawInput.slice(0, 1200) + "..." : rawInput;

  const beliefBlock = beliefStates && beliefStates.size > 0
    ? `\nIMPORTANT: Each persona's "Current belief" line above is their structured state going INTO this round. Their next utterance must be coherent with it: if confidence is high they push back harder; if last round shifted them, they acknowledge it explicitly ("@X — your point about Y did move me"). Do NOT make a persona suddenly flip without explaining what shifted them.\n`
    : "";

  const reflectionBlock = reflectionLines && reflectionLines.length > 0
    ? `\n${reflectionLines.map((l) => `>> ${l}`).join("\n")}\nThe directives above describe the *current shape of the debate*. The personas should respond to those dynamics in this round — specifically, engage with whichever directive applies to them (un-responded claims, cycles, frozen stances, premature convergence, or no concessions).\n`
    : "";

  const beliefSchemaFields = beliefStates
    ? `,
      "active_listening": {
        "claims_heard_this_round": [{ "speaker": "<persona_id>", "claim_summary": "<≤30 chars>", "threatens_my_position": <true|false> }],
        "must_address": ["<claim_summary you will engage with>"]
      },
      "belief_update": {
        "new_position": <number -1..+1, where -1 = strongly against the topic_focus, +1 = strongly for>,
        "new_confidence": <number 0..1>,
        "shifted_because": "<null if unchanged, or 1-line: which speaker + which specific claim moved you>"
      }`
    : "";

  const tomSchemaSample = selectedPersonas.length > 1
    ? buildToMSchemaField(selectedPersonas.map((p) => p.id))
    : "";

  const tomDirective = tomStates && tomStates.size > 0
    ? `\nIMPORTANT (theory-of-mind): Each "Prior theory-of-mind reads" block above shows what YOU thought each other persona believed. Where the actual position now contradicts your prior read, you MUST name that gap explicitly in your message ("@X — I thought you assumed Y, but your last point shows Z"). Then emit a fresh "theory_of_mind" array for THIS round, one entry per OTHER persona, calibrated to what they actually said.\n`
    : "";

  const prompt = `Round ${roundNumber}/3 — Theme: "${theme}"

The topic being debated (this is what every argument must reference):
${buildTopicBlock(project)}

Original user submission (canonical source for quotes):
${rawInputExcerpt}

Personas in this debate:
${personaProfiles}
${context}
${beliefBlock}${reflectionBlock}${tomDirective}
Generate each selected persona's response for this round. Each persona MUST:
- Stay in character (reflect their psychology, biases, communication style).
- Directly respond to other personas' arguments from previous rounds — when doing so, quote the phrase they are reacting to.
- Reference at least one SPECIFIC element of the topic (a named feature, number, stakeholder, or quoted phrase from the user's submission) in every message.
- Concede points when genuinely convinced; push back when not — cite the evidence that moved them or failed to.
- Avoid generic debate clichés. BANNED phrases: "I see your point but", "that's a fair concern", "on balance", "at the end of the day". Rewrite into specifics grounded in the topic.

Respond with JSON:
{
  "messages": [
    {
      "persona_id": "<id>",
      "content": "<their argument, 2-4 sentences, referencing a specific element of the topic and (from round 2 onward) quoting another persona's phrase>",
      "responding_to": "<persona_id they're primarily responding to, or null for round 1>",
      "stance_shift": "<null if unchanged, or brief description of how their view shifted and which argument caused it>"${beliefSchemaFields}${tomSchemaSample}${buildMoveSchemaField()}
    }
  ]
}`;

  return { system: buildSystem(replyLanguage), prompt };
}

export function buildOutcomePrompt(
  selectedPersonas: Persona[],
  allRounds: Array<{ round: number; messages: Array<{ persona_id: string; content: string }> }>,
  project: ProjectParsedData,
  replyLanguage: ReplyLanguage = "en",
): { system: string; prompt: string } {
  const debateLog = allRounds.map((r) =>
    `--- Round ${r.round} ---\n` + r.messages.map((m) => {
      const name = selectedPersonas.find((p) => p.id === m.persona_id)?.identity.name || m.persona_id;
      return `${name}: ${m.content}`;
    }).join("\n")
  ).join("\n\n");

  const prompt = `Summarize the outcome of this debate about the topic below.

${buildTopicBlock(project)}

Debate transcript:
${debateLog}

Your outcome must be grounded in what the personas actually argued — cite specific moments when possible. "Key insights" should name a participant and the specific point they crystallized; "remaining disagreements" should name who disagreed with whom and over which specific claim.

Respond with JSON:
{
  "consensus_reached": <true|false>,
  "key_insights": ["<insight that emerged, naming the persona who crystallized it>", ...],
  "remaining_disagreements": ["<unresolved point, naming the personas on each side and the specific claim>", ...]
}`;

  return { system: buildSystem(replyLanguage), prompt };
}
