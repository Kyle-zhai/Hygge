import type { LLMAdapter } from "../llm/adapter.js";
import type { Persona } from "../types/persona.js";
import { robustJsonParse } from "../utils/json-parse.js";

const RECOMMEND_SYSTEM = `You are a discussion panel coordinator. Given a topic description and a list of available personas, recommend the most relevant personas for discussing this topic. The topic may be a product, idea, policy, event, design, creative work, business strategy, or any other subject.

Consider:
- The topic's target audience or stakeholders — include personas that match or represent them
- Diverse perspectives — include technical, business, creative, and end-user viewpoints as appropriate
- Relevant expertise — include personas whose background and expertise are relevant to the topic domain
- Constructive tension — include personas who may have differing viewpoints to enrich the discussion

Respond ONLY with valid JSON:
{
  "recommended_ids": ["<persona_id_1>", "<persona_id_2>", ...],
  "reasoning": "<brief explanation of why these personas were chosen>"
}`;

export async function recommendPersonas(
  llm: LLMAdapter,
  projectDescription: string,
  availablePersonas: Persona[],
  targetCount: number = 10,
): Promise<{ recommended_ids: string[]; reasoning: string }> {
  const personaList = availablePersonas
    .map(
      (p) =>
        `- ID: ${p.id} | ${p.identity.name} | ${p.demographics.occupation} | Focus: ${p.evaluation_lens.primary_question}`
    )
    .join("\n");

  const response = await llm.complete({
    system: RECOMMEND_SYSTEM,
    prompt: `Topic: ${projectDescription}

Aim for ${targetCount} personas — pick the ${targetCount} most relevant covering distinct viewpoints, not the safest ${targetCount}. Prefer breadth (technical + business + design + end-user + finance + skeptic) over redundancy.

Available personas:
${personaList}`,
    maxTokens: 2048,
  });

  return robustJsonParse(response.text);
}
