import type { Persona } from "../types/persona.js";
import type { EvaluationScores } from "../types/evaluation.js";

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

IMPORTANT: Always respond in English. Output valid JSON only.`;

export function buildSelectionPrompt(
  personas: Persona[],
  reviews: ReviewForDebate[],
): { system: string; prompt: string } {
  const reviewSummaries = reviews.map((r) => {
    const stanceInfo = r.overall_stance ? ` (stance: ${r.overall_stance})` : "";
    return `- ${r.persona_name}${stanceInfo}: ${r.review_text.slice(0, 200)}`;
  }).join("\n");

  const prompt = `Given these persona reviews, select 4-6 personas with the MOST divergent views for a round-table debate. Identify the core disagreement to debate.

Reviews:
${reviewSummaries}

Respond with JSON:
{
  "selected_persona_ids": ["id1", "id2", ...],
  "topic_focus": "<the core disagreement or tension to debate, 1 sentence>",
  "round_themes": ["<round 1 focus>", "<round 2 focus>", "<round 3 focus>"]
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
): { system: string; prompt: string } {
  const personaProfiles = selectedPersonas.map((p) => {
    const review = reviews.find((r) => r.persona_id === p.id);
    return `[${p.id}] ${p.identity.name} — ${p.demographics.occupation}
Psychology: ${p.psychology.personality_type}, decision style: ${p.psychology.decision_making.style}
Initial position: ${review?.review_text.slice(0, 150) || "N/A"}
Stance: ${review?.overall_stance || "N/A"}`;
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

  const prompt = `Round ${roundNumber}/3 — Theme: "${theme}"

Personas in this debate:
${personaProfiles}
${context}

Generate each selected persona's response for this round. Each persona should:
- Stay in character (reflect their psychology, biases, communication style)
- Directly respond to others' arguments from previous rounds (if any)
- Concede points when genuinely convinced, push back when not
- Be specific, not generic

Respond with JSON:
{
  "messages": [
    {
      "persona_id": "<id>",
      "content": "<their argument, 2-4 sentences>",
      "responding_to": "<persona_id they're primarily responding to, or null for round 1>",
      "stance_shift": "<null if unchanged, or brief description of how their view shifted>"
    }
  ]
}`;

  return { system: SYSTEM, prompt };
}

export function buildOutcomePrompt(
  selectedPersonas: Persona[],
  allRounds: Array<{ round: number; messages: Array<{ persona_id: string; content: string }> }>,
): { system: string; prompt: string } {
  const debateLog = allRounds.map((r) =>
    `--- Round ${r.round} ---\n` + r.messages.map((m) => {
      const name = selectedPersonas.find((p) => p.id === m.persona_id)?.identity.name || m.persona_id;
      return `${name}: ${m.content}`;
    }).join("\n")
  ).join("\n\n");

  const prompt = `Summarize the outcome of this debate:

${debateLog}

Respond with JSON:
{
  "consensus_reached": <true|false>,
  "key_insights": ["<insight that emerged from the debate>", ...],
  "remaining_disagreements": ["<unresolved point>", ...]
}`;

  return { system: SYSTEM, prompt };
}
