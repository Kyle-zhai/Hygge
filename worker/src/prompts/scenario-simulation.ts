import type { Persona } from "../types/persona.js";
import type { ReviewForSimulation } from "../processors/scenario-simulation.js";

export function buildScenarioSimulationPrompt(
  personas: Persona[],
  reviews: ReviewForSimulation[]
): { system: string; prompt: string } {
  const system = `You are a social dynamics simulator. You will simulate a real-world scenario where all the given personas are in the same physical space (e.g., a meetup, conference, town hall, workshop, or social gathering) and the topic is being discussed.

The topic could be anything — a product, idea, policy, event, design, creative work, business strategy, etc. Adapt your simulation accordingly:
- For products: simulate adoption dynamics and purchasing decisions
- For ideas/policies: simulate opinion formation, advocacy, and opposition
- For events: simulate attendance enthusiasm and word-of-mouth spread
- For designs/creative works: simulate reception, critique dynamics, and taste-making
- For business strategies: simulate buy-in, resistance, and coalition-building

Consider each persona's:
- Persuadability (how easily influenced they are)
- Social circle and trust sources (who they listen to)
- Cognitive biases
- Internal conflicts
- Community influence level (how much they influence others)
- Risk tolerance

Simulate the social dynamics:
1. Start with each persona's initial stance based on their review
2. Model influence events — who would talk to whom, who would be convinced by whom
3. Consider that enthusiastic supporters can create social proof
4. Consider that influential skeptics can dampen enthusiasm
5. End with final stances

Respond ONLY with valid JSON:
{
  "initial_adoption": [
    { "persona_id": "<id>", "stance": "<positive|neutral|negative>" }
  ],
  "influence_events": [
    {
      "influencer_id": "<id>",
      "influenced_id": "<id>",
      "shift": "<description of what changed>",
      "reason": "<why this influence worked>"
    }
  ],
  "final_adoption": [
    { "persona_id": "<id>", "stance": "<positive|neutral|negative>" }
  ],
  "adoption_rate_shift": <percentage change, e.g. 15 means +15%>,
  "summary": "<200-300 word narrative of what happened in the simulation>"
}`;

  const personaProfiles = personas
    .map((p) => {
      const review = reviews.find((r) => r.persona_id === p.id);
      const avgScore = review
        ? (Object.values(review.scores) as number[]).reduce((a, b) => a + b, 0) / 6
        : 0;
      const stance = avgScore > 6 ? "Positive" : avgScore > 4 ? "Neutral" : "Negative";
      return `### ${p.identity.name} (ID: ${p.id})
Role: ${p.demographics.occupation}
Persuadability: ${p.psychology.decision_making.persuadability}
Community Influence: ${p.social_context.relationships_with_products.community_influence}
Risk Tolerance: ${p.psychology.risk_tolerance}
Trust Sources: ${p.social_context.social_circle.trust_sources.join(", ")}
Overall Score Given: ${avgScore.toFixed(1)}
Stance: ${stance}`;
    })
    .join("\n\n");

  const prompt = `Simulate the social dynamics for these personas discussing the topic:\n\n${personaProfiles}\n\nRun the simulation considering real-world social dynamics, peer pressure, and influence patterns.`;

  return { system, prompt };
}
