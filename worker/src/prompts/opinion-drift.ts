import type { Persona } from "../types/persona.js";
import type { EvaluationScores } from "../types/evaluation.js";

interface ReviewInput {
  persona_id: string;
  persona_name: string;
  scores: EvaluationScores;
  review_text: string;
  strengths: string[];
  weaknesses: string[];
}

const STANCE_TO_NUMBER: Record<string, number> = {
  strongly_positive: 10,
  strongly_support: 10,
  positive: 8,
  support: 8,
  neutral: 5,
  negative: 3,
  oppose: 3,
  strongly_negative: 1,
  strongly_oppose: 1,
};

function computeLeaning(scores: EvaluationScores): string {
  const values = Object.values(scores as Record<string, number | string>);
  if (values.length === 0) return "neutral";
  const numeric = values.map((v) =>
    typeof v === "number" ? v : typeof v === "string" ? STANCE_TO_NUMBER[v] ?? 5 : 5,
  );
  const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;
  if (avg >= 7) return "positive";
  if (avg <= 4) return "negative";
  return "neutral";
}

export function buildOpinionDriftPrompt(
  personas: Persona[],
  reviews: ReviewInput[],
): { system: string; prompt: string; initialLeanings: Record<string, string> } {
  const initialLeanings: Record<string, string> = {};
  for (const r of reviews) initialLeanings[r.persona_id] = computeLeaning(r.scores);

  const personaProfiles = personas
    .map((p) => {
      const review = reviews.find((r) => r.persona_id === p.id);
      if (!review) return "";
      return `### ${p.identity.name} (ID: ${p.id})
Role: ${p.demographics.occupation}
Persuadability: ${p.psychology.decision_making.persuadability}
Risk Tolerance: ${p.psychology.risk_tolerance}
Current stance: ${initialLeanings[p.id]}
Their review (excerpt):
${review.review_text.slice(0, 500)}
Strengths they noted: ${review.strengths.slice(0, 3).join("; ")}
Weaknesses they noted: ${review.weaknesses.slice(0, 3).join("; ")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const system = `You are an analyst studying how opinions evolve in a group discussion. You will be given several personas who have each independently reviewed the same topic. Your job is to predict — for each persona — how their stance would shift AFTER they hear the rest of the room's perspectives.

For each persona, consider:
- Their persuadability (low → rarely shifts, high → shifts easily)
- Whether other personas raise points that would hit their blind spots or reinforce their biases
- Whether there's a clear majority view that would create social proof
- Whether a specific other persona is likely to sway them via their expertise or trust

Output a "final_leaning" — their stance AFTER the discussion. Output "shift_magnitude":
- "none" if they stick to their initial view
- "small" if their stance softens/hardens but doesn't flip
- "large" if they flip sides (positive ↔ negative) or break out of neutral into a strong stance

IMPORTANT: Always respond in English. Base your analysis on the actual reviews, not generic assumptions.

Respond ONLY with valid JSON:
{
  "drifts": [
    {
      "persona_id": "<id>",
      "initial_leaning": "<positive|negative|neutral|mixed>",
      "final_leaning": "<positive|negative|neutral|mixed>",
      "shift_magnitude": "<none|small|large>",
      "reasoning": "<1-2 sentence narrative of why they would or wouldn't shift, citing a SPECIFIC other persona or argument>"
    }
  ]
}`;

  const prompt = `Analyze how each persona's stance would shift after the group discussion:\n\n${personaProfiles}\n\nFor each persona, use their "initial_leaning" exactly as provided (don't recompute from their scores). Then predict final_leaning, shift_magnitude, and a concrete reasoning citing another persona by name when relevant.`;

  return { system, prompt, initialLeanings };
}
