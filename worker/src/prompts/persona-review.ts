import type { Persona } from "../types/persona.js";
import type { ProjectParsedData, TopicClassification } from "../types/evaluation.js";

const FIXED_DIMENSIONS_INSTRUCTION = `- Score each dimension from 1-10 (integers only)
- Adapt the meaning of each dimension to fit the topic type:
  * usability: For products, how easy to use. For ideas/policies, how practical to implement. For events, how accessible. For designs/creative works, how clear and engaging.
  * market_fit: For products, product-market fit. For ideas/policies, relevance to the target audience or stakeholders. For events, audience appeal. For creative works, audience resonance.
  * design: For products, visual/UX design. For ideas/policies, how well-structured the approach is. For events, organization and experience design. For creative works, craft and aesthetics.
  * tech_quality: For products, technical implementation. For ideas, technical feasibility. For policies, rigor and evidence base. For other topics, quality of execution or foundation.
  * innovation: How novel or original the topic is in its domain.
  * pricing: For products, value proposition. For policies/ideas, cost-effectiveness or resource efficiency. For other topics, overall value relative to effort/investment.`;

const FIXED_SCORES_SCHEMA = `"scores": {
    "usability": <1-10>,
    "market_fit": <1-10>,
    "design": <1-10>,
    "tech_quality": <1-10>,
    "innovation": <1-10>,
    "pricing": <1-10>
  }`;

function buildDynamicDimensionsInstruction(dimensions: TopicClassification["dimensions"]): string {
  const lines = dimensions.map(d => `  * ${d.key}: ${d.description}`);
  return `- For each dimension, express your STANCE (not a numerical score). Use one of: strongly_positive, positive, neutral, negative, strongly_negative
- "positive" means you are leaning IN FAVOR of the topic/proposition on that dimension; "negative" means you are leaning AGAINST it. For open-ended questions, treat "positive" as endorsing the direction and "negative" as cautioning against it. Use "neutral" only when you genuinely have no lean.
- Your stance reflects your character's position on that aspect of the topic:\n${lines.join("\n")}`;
}

function buildDynamicScoresSchema(dimensions: TopicClassification["dimensions"]): string {
  const fields = dimensions.map(d => `    "${d.key}": "<strongly_positive|positive|neutral|negative|strongly_negative>"`).join(",\n");
  return `"stances": {\n${fields}\n  }`;
}

export function buildPersonaReviewPrompt(
  persona: Persona,
  project: ProjectParsedData,
  rawInput: string,
  dimensions?: TopicClassification["dimensions"]
): { system: string; prompt: string } {
  const dimensionsInstruction = dimensions
    ? buildDynamicDimensionsInstruction(dimensions)
    : FIXED_DIMENSIONS_INSTRUCTION;

  const scoresSchema = dimensions
    ? buildDynamicScoresSchema(dimensions)
    : FIXED_SCORES_SCHEMA;

  const system = `${persona.system_prompt}

You are providing your perspective on a topic submitted for discussion. The topic could be a product, idea, policy, event, design, creative work, business strategy, or anything else. Stay completely in character. Your evaluation should reflect your unique perspective, biases, blind spots, and emotional reactions as defined in your character.

IMPORTANT EVALUATION RULES:
${dimensionsInstruction}
- Your scoring should reflect your scoring_weights — dimensions you care about more should have more detailed analysis
- You MUST reference SPECIFIC details from the user's submission — quote exact phrases, mention specific features/claims/data points, and explain why they matter from your perspective. NEVER give generic feedback like "the product has potential" without citing what specifically impressed or concerned you.
- Your review MUST include CONCRETE DATA when possible: cite statistics, market data, research findings, industry benchmarks, or relevant case studies that support your analysis. For example, instead of "the market is competitive", say "the CRM market reached $58B in 2023 (Gartner), dominated by Salesforce at 23% share — entering without a clear wedge is risky."
- Your strengths/weaknesses should reflect YOUR perspective AND cite specific evidence from the submission
- If something triggers your known biases or blind spots, let that show naturally
- React to the topic the way you would in real life based on your contextual_behaviors
- If the submission includes a document (resume, report, etc.), your review MUST address the specific content of that document, not just the concept of it

IMPORTANT: Always respond in English regardless of the input language. Your review_text, strengths, and weaknesses must all be in English.

Respond ONLY with valid JSON in this exact format:
{
  ${scoresSchema},
  "overall_stance": "<strongly_positive|positive|neutral|negative|strongly_negative>",
  "review_text": "<Your detailed review, 300-500 words, written in first person as your character. Must include specific data points, statistics, or case studies to back up your claims.>",
  "strengths": ["<specific strength 1>", "<specific strength 2>", ...],
  "weaknesses": ["<specific weakness 1>", "<specific weakness 2>", ...],
  "cited_references": [
    { "claim": "<specific factual claim you made>", "source": "<data source, study, benchmark, or case study>" }
  ]
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
