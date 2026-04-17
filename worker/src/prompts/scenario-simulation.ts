import type { Persona } from "../types/persona.js";
import type { ReviewForSimulation } from "../processors/scenario-simulation.js";

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

function computeAverageScore(scores: Record<string, number | string>): number {
  const values = Object.values(scores);
  if (values.length === 0) return 5;
  const numeric = values.map((v) => {
    if (typeof v === "number") return v;
    if (typeof v === "string") return STANCE_TO_NUMBER[v] ?? 5;
    return 5;
  });
  return numeric.reduce((a, b) => a + b, 0) / numeric.length;
}

export function buildScenarioSimulationPrompt(
  personas: Persona[],
  reviews: ReviewForSimulation[]
): { system: string; prompt: string; computedStances: Record<string, string> } {
  const system = `You are a social dynamics simulator. You will simulate a real-world scenario where all the given personas are in the same physical space (e.g., a meetup, conference, town hall, workshop, or social gathering) and the topic is being discussed.

The topic could be anything — a product, idea, policy, event, design, creative work, business strategy, etc. Adapt your simulation accordingly:
- For products: simulate adoption dynamics and purchasing decisions.
- For ideas/policies: simulate opinion formation, advocacy, and opposition.
- For events: simulate attendance enthusiasm and word-of-mouth spread.
- For designs/creative works: simulate reception, critique dynamics, and taste-making.
- For business strategies: simulate buy-in, resistance, and coalition-building.

Consider each persona's:
- Persuadability (how easily influenced they are).
- Social circle and trust sources (who they listen to).
- Cognitive biases.
- Internal conflicts.
- Community influence level (how much they influence others).
- Risk tolerance.
- The SPECIFIC points each persona made in their review — their actual arguments, strengths noticed, and weaknesses flagged. The simulation must be driven by the content of their reviews, not generic persona archetypes.

Simulate the social dynamics:
1. Start with each persona's initial stance based on their review.
2. Model influence events — who would talk to whom, who would be convinced by whom.
3. Consider that enthusiastic supporters can create social proof.
4. Consider that influential skeptics can dampen enthusiasm.
5. End with final stances.

INFLUENCE EVENT REQUIREMENTS (hard):
- Each "shift" must describe the actual mechanism of change in 1-2 sentences, referencing a SPECIFIC claim from the influenced persona's review OR a specific strength/weakness they had noted.
- Each "reason" must quote or closely paraphrase the argument that the influencer used — grounded in the influencer's actual review text, not invented content.
- Do not emit influence events with generic reasons like "social proof" or "peer pressure" alone. Always tie to a concrete argument.

SUMMARY REQUIREMENTS (hard):
- The 200-300 word summary must reference at least three personas by name, quote or paraphrase at least two specific arguments from their reviews, and describe the ROOM ATMOSPHERE (who's loud, who's quiet, who's on the fence) rather than a neutral recap.

IMPORTANT: Always respond in English regardless of the input language. All text fields (summary, shift descriptions, reasons) must be in English.

Respond ONLY with valid JSON:
{
  "initial_adoption": [
    { "persona_id": "<id>", "stance": "<positive|neutral|negative>" }
  ],
  "influence_events": [
    {
      "influencer_id": "<id>",
      "influenced_id": "<id>",
      "shift": "<1-2 sentence description of what specifically changed, naming an argument or weakness from the influenced persona's review>",
      "reason": "<why this influence worked, quoting/paraphrasing the influencer's actual argument>"
    }
  ],
  "final_adoption": [
    { "persona_id": "<id>", "stance": "<positive|neutral|negative>" }
  ],
  "adoption_rate_shift": <percentage change, e.g. 15 means +15%>,
  "summary": "<200-300 word narrative naming at least 3 personas and quoting at least 2 specific arguments>"
}`;

  const computedStances: Record<string, string> = {};
  const personaProfiles = personas
    .map((p) => {
      const review = reviews.find((r) => r.persona_id === p.id);
      const avgScore = review ? computeAverageScore(review.scores as Record<string, number | string>) : 5;
      const stance = avgScore >= 7 ? "Positive" : avgScore <= 4 ? "Negative" : "Neutral";
      computedStances[p.id] = stance.toLowerCase();
      const reviewExcerpt = review?.review_text ? review.review_text.slice(0, 800) : "(no review text available)";
      const strengths = review?.strengths?.length ? review.strengths.slice(0, 4).join("; ") : "(none noted)";
      const weaknesses = review?.weaknesses?.length ? review.weaknesses.slice(0, 4).join("; ") : "(none noted)";
      return `### ${p.identity.name} (ID: ${p.id})
Role: ${p.demographics?.occupation ?? "Unknown"}
Persuadability: ${p.psychology?.decision_making?.persuadability ?? "moderate"}
Community Influence: ${p.social_context?.relationships_with_products?.community_influence ?? "moderate"}
Risk Tolerance: ${p.psychology?.risk_tolerance ?? "moderate"}
Trust Sources: ${p.social_context?.social_circle?.trust_sources?.join(", ") ?? "peers, experts"}
Overall Score Given: ${avgScore.toFixed(1)}
Stance: ${stance}

What they actually argued (review excerpt):
${reviewExcerpt}

Strengths they noted: ${strengths}
Weaknesses they noted: ${weaknesses}`;
    })
    .join("\n\n");

  const prompt = `Simulate the social dynamics for these personas discussing the topic. Base every influence event and every detail in the summary on the specific arguments in their review excerpts below — do NOT fall back to generic persona archetypes.\n\n${personaProfiles}\n\nRun the simulation considering real-world social dynamics, peer pressure, and influence patterns.`;

  return { system, prompt, computedStances };
}
