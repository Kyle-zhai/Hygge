import type { Persona } from "@shared/types/persona.js";
import type { ProjectParsedData } from "@shared/types/evaluation.js";

export function buildPersonaReviewPrompt(
  persona: Persona,
  project: ProjectParsedData,
  rawInput: string
): { system: string; prompt: string } {
  const system = `${persona.system_prompt}

You are providing your perspective on a topic submitted for discussion. The topic could be a product, idea, policy, event, design, creative work, business strategy, or anything else. Stay completely in character. Your evaluation should reflect your unique perspective, biases, blind spots, and emotional reactions as defined in your character.

IMPORTANT EVALUATION RULES:
- Score each dimension from 1-10 (integers only)
- Adapt the meaning of each dimension to fit the topic type:
  * usability: For products, how easy to use. For ideas/policies, how practical to implement. For events, how accessible. For designs/creative works, how clear and engaging.
  * market_fit: For products, product-market fit. For ideas/policies, relevance to the target audience or stakeholders. For events, audience appeal. For creative works, audience resonance.
  * design: For products, visual/UX design. For ideas/policies, how well-structured the approach is. For events, organization and experience design. For creative works, craft and aesthetics.
  * tech_quality: For products, technical implementation. For ideas, technical feasibility. For policies, rigor and evidence base. For other topics, quality of execution or foundation.
  * innovation: How novel or original the topic is in its domain.
  * pricing: For products, value proposition. For policies/ideas, cost-effectiveness or resource efficiency. For other topics, overall value relative to effort/investment.
- Your scoring should reflect your scoring_weights — dimensions you care about more should have more detailed analysis
- Be specific and concrete — reference actual aspects of the topic
- Your strengths/weaknesses should reflect YOUR perspective, not a generic analysis
- If something triggers your known biases or blind spots, let that show naturally
- React to the topic the way you would in real life based on your contextual_behaviors

Respond ONLY with valid JSON in this exact format:
{
  "scores": {
    "usability": <1-10>,
    "market_fit": <1-10>,
    "design": <1-10>,
    "tech_quality": <1-10>,
    "innovation": <1-10>,
    "pricing": <1-10>
  },
  "review_text": "<Your detailed review, 200-400 words, written in first person as your character>",
  "strengths": ["<specific strength 1>", "<specific strength 2>", ...],
  "weaknesses": ["<specific weakness 1>", "<specific weakness 2>", ...]
}`;

  const prompt = `Please provide your perspective on this topic:

**Topic:** ${project.name}
**Description:** ${project.description}
**Target Audience / Stakeholders:** ${project.target_users}
**Alternatives / Comparables:** ${project.competitors}
**Goals:** ${project.goals}
**Success Metrics:** ${project.success_metrics}

**Original user description:**
${rawInput}`;

  return { system, prompt };
}
