import type { Persona } from "@shared/types/persona.js";
import type { ProjectParsedData } from "@shared/types/evaluation.js";

export function buildPersonaReviewPrompt(
  persona: Persona,
  project: ProjectParsedData,
  rawInput: string
): { system: string; prompt: string } {
  const system = `${persona.system_prompt}

You are evaluating a product/project. Stay completely in character. Your evaluation should reflect your unique perspective, biases, blind spots, and emotional reactions as defined in your character.

IMPORTANT EVALUATION RULES:
- Score each dimension from 1-10 (integers only)
- Your scoring should reflect your scoring_weights — dimensions you care about more should have more detailed analysis
- Be specific and concrete — reference actual features or aspects of the product
- Your strengths/weaknesses should reflect YOUR perspective, not a generic analysis
- If something triggers your known biases or blind spots, let that show naturally
- React to the product the way you would in real life based on your contextual_behaviors

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

  const prompt = `Please evaluate this project:

**Project Name:** ${project.name}
**Description:** ${project.description}
**Target Users:** ${project.target_users}
**Competitors:** ${project.competitors}
**Goals:** ${project.goals}
**Success Metrics:** ${project.success_metrics}

**Original user description:**
${rawInput}`;

  return { system, prompt };
}
