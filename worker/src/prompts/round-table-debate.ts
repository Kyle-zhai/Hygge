import type { Persona } from "../types/persona.js";
import type { EvaluationScores, ProjectParsedData } from "../types/evaluation.js";

export interface ReviewForDebate {
  persona_id: string;
  persona_name: string;
  scores: EvaluationScores | Record<string, string>;
  review_text: string;
  strengths: string[];
  weaknesses: string[];
  overall_stance?: string | null;
}

const SYSTEM = `You are orchestrating a round-table debate between AI personas. Each persona has distinct values, biases, and communication styles defined by their profiles. Generate authentic responses that reflect each persona's psychology, not generic arguments.

The debate must be anchored in the specific topic submitted by the user — every argument should reference concrete elements of that topic (named features, numbers, claims, phrases, stakeholders) rather than abstract positions.

IMPORTANT: Always respond in English. Output valid JSON only.`;

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

  return { system: SYSTEM, prompt };
}

export function buildDebateRoundPrompt(
  roundNumber: number,
  theme: string,
  selectedPersonas: Persona[],
  reviews: ReviewForDebate[],
  previousRounds: Array<{ round: number; messages: Array<{ persona_id: string; content: string }> }>,
  project: ProjectParsedData,
  rawInput: string,
): { system: string; prompt: string } {
  const personaProfiles = selectedPersonas.map((p) => {
    const review = reviews.find((r) => r.persona_id === p.id);
    const strengths = review?.strengths?.length ? review.strengths.slice(0, 3).join("; ") : "(none noted)";
    const weaknesses = review?.weaknesses?.length ? review.weaknesses.slice(0, 3).join("; ") : "(none noted)";
    return `[${p.id}] ${p.identity.name} — ${p.demographics.occupation}
Psychology: ${p.psychology?.personality_type ?? "analytical"}, decision style: ${p.psychology?.decision_making?.style ?? "balanced"}
Stance: ${review?.overall_stance || "N/A"}
Their review (initial position):
${review?.review_text.slice(0, 600) || "N/A"}
Strengths they noted: ${strengths}
Weaknesses they noted: ${weaknesses}`;
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

  const prompt = `Round ${roundNumber}/3 — Theme: "${theme}"

The topic being debated (this is what every argument must reference):
${buildTopicBlock(project)}

Original user submission (canonical source for quotes):
${rawInputExcerpt}

Personas in this debate:
${personaProfiles}
${context}

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
      "stance_shift": "<null if unchanged, or brief description of how their view shifted and which argument caused it>"
    }
  ]
}`;

  return { system: SYSTEM, prompt };
}

export function buildOutcomePrompt(
  selectedPersonas: Persona[],
  allRounds: Array<{ round: number; messages: Array<{ persona_id: string; content: string }> }>,
  project: ProjectParsedData,
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

  return { system: SYSTEM, prompt };
}
