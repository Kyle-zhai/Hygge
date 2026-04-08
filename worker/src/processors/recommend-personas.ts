import type { LLMAdapter } from "../llm/adapter.js";
import type { Persona } from "../../shared/types/persona.js";

const RECOMMEND_SYSTEM = `You are a focus group coordinator. Given a project description and a list of available personas, recommend the most relevant personas for evaluating this project.

Consider:
- The project's target users — include personas that match the target audience
- Diverse perspectives — include technical, business, design, and end-user viewpoints
- Relevant expertise — include personas whose expertise is relevant to the project domain

Respond ONLY with valid JSON:
{
  "recommended_ids": ["<persona_id_1>", "<persona_id_2>", ...],
  "reasoning": "<brief explanation of why these personas were chosen>"
}`;

export async function recommendPersonas(
  llm: LLMAdapter,
  projectDescription: string,
  availablePersonas: Persona[]
): Promise<{ recommended_ids: string[]; reasoning: string }> {
  const personaList = availablePersonas
    .map(
      (p) =>
        `- ID: ${p.id} | ${p.identity.name} | ${p.demographics.occupation} | Focus: ${p.evaluation_lens.primary_question}`
    )
    .join("\n");

  const response = await llm.complete({
    system: RECOMMEND_SYSTEM,
    prompt: `Project: ${projectDescription}\n\nAvailable personas:\n${personaList}`,
    maxTokens: 1024,
  });

  return JSON.parse(response.text);
}
