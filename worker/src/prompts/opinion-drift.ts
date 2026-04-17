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
Role: ${p.demographics?.occupation ?? "Unknown"}
Persuadability: ${p.psychology?.decision_making?.persuadability ?? "moderate"}
Risk Tolerance: ${p.psychology?.risk_tolerance ?? "moderate"}
Trust Sources: ${(p.social_context?.social_circle?.trust_sources ?? []).join(", ") || "unspecified"}
Current stance: ${initialLeanings[p.id]}
Their review (full):
${review.review_text.slice(0, 1200)}
Strengths they noted: ${review.strengths.slice(0, 5).join("; ")}
Weaknesses they noted: ${review.weaknesses.slice(0, 5).join("; ")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const system = `You are an analyst studying how opinions evolve in a group discussion. You will be given several personas who have each independently reviewed the same topic. Your job is to predict — for each persona — how their stance would shift AFTER they hear the rest of the room's perspectives.

For each persona, consider:
- Their persuadability (low → rarely shifts, high → shifts easily).
- Whether other personas raise points that would hit their blind spots or reinforce their biases.
- Whether there's a clear majority view that would create social proof.
- Whether a specific other persona is likely to sway them via their expertise, trust sources, or shared concerns.
- Whether the strengths/weaknesses one persona surfaced directly address risks another persona ignored.

Output a "final_leaning" — their stance AFTER the discussion. Output "shift_magnitude":
- "none" if they stick to their initial view.
- "small" if their stance softens/hardens but doesn't flip.
- "large" if they flip sides (positive ↔ negative) or break out of neutral into a strong stance.

REASONING REQUIREMENTS (hard):
- Reasoning must be 3-4 full sentences.
- It must NAME at least one other persona by name (not "the other reviewer").
- It must QUOTE or closely paraphrase a specific point from that other persona's review — enough that a reader can tell WHICH argument did the moving (or failed to).
- It must connect that point to this persona's psychology (persuadability, risk tolerance, trust sources, or a known blind spot).
- If "shift_magnitude" is "none", the reasoning must still name the strongest opposing argument and explain why it FAILED to move this persona — do not just say "they are stubborn" or "low persuadability".

BANNED reasoning patterns: "would likely shift due to social proof", "stays firm due to low persuadability", "is persuaded by the majority", "remains skeptical". If you catch yourself writing these, expand into the specific argument and specific persona instead.

IMPORTANT: Always respond in English. Base your analysis on the actual reviews, not generic assumptions about the persona type.

Respond ONLY with valid JSON:
{
  "drifts": [
    {
      "persona_id": "<id>",
      "initial_leaning": "<positive|negative|neutral|mixed>",
      "final_leaning": "<positive|negative|neutral|mixed>",
      "shift_magnitude": "<none|small|large>",
      "reasoning": "<3-4 sentence narrative naming a specific other persona, quoting or closely paraphrasing their argument, and tying it to this persona's psychology>"
    }
  ]
}`;

  const prompt = `Analyze how each persona's stance would shift after the group discussion:\n\n${personaProfiles}\n\nFor each persona, use their "initial_leaning" exactly as provided (don't recompute from their scores). Then predict final_leaning, shift_magnitude, and a 3-4 sentence reasoning that names another persona by name, cites a specific argument they made, and ties it to this persona's psychology.`;

  return { system, prompt, initialLeanings };
}
