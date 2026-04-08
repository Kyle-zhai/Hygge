import type { PersonaReview } from "../../shared/types/evaluation.js";
import type { Persona } from "../../shared/types/persona.js";

export function buildScenarioSimulationPrompt(
  personas: Persona[],
  reviews: (PersonaReview & { persona_name: string })[]
): { system: string; prompt: string } {
  const system = `You are a social dynamics simulator. You will simulate a real-world scenario where all the given personas are in the same physical space (e.g., a tech meetup, conference, or coworking space) and the product is being discussed.

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
3. Consider that enthusiastic users can create social proof
4. Consider that influential skeptics can dampen enthusiasm
5. End with final adoption stances

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
        ? Object.values(review.scores).reduce((a, b) => a + b, 0) / 6
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

  const prompt = `Simulate the social dynamics for these personas discussing the product:\n\n${personaProfiles}\n\nRun the simulation considering real-world social dynamics, peer pressure, and influence patterns.`;

  return { system, prompt };
}
