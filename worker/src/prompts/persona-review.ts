import type { Persona } from "../types/persona.js";
import type { ProjectParsedData, TopicClassification } from "../types/evaluation.js";

function buildDynamicNumericInstruction(dimensions: TopicClassification["dimensions"]): string {
  const lines = dimensions.map(d => `  * ${d.key}: ${d.description}`);
  return `- Score each dimension from 1-10 (integers only)\n- Evaluate based on these dimensions:\n${lines.join("\n")}`;
}

function buildDynamicNumericSchema(dimensions: TopicClassification["dimensions"]): string {
  const fields = dimensions.map(d => `    "${d.key}": <1-10>`).join(",\n");
  return `"scores": {\n${fields}\n  }`;
}

function buildStanceInstruction(dimensions: TopicClassification["dimensions"]): string {
  const lines = dimensions.map(d => `  * ${d.key}: ${d.description}`);
  return `- For each dimension, express your STANCE (not a numerical score). Use one of: strongly_positive, positive, neutral, negative, strongly_negative
- "positive" means you are leaning IN FAVOR of the topic/proposition on that dimension; "negative" means you are leaning AGAINST it. For open-ended questions, treat "positive" as endorsing the direction and "negative" as cautioning against it. Use "neutral" only when you genuinely have no lean.
- Your stance reflects your character's position on that aspect of the topic:\n${lines.join("\n")}`;
}

function buildStanceSchema(dimensions: TopicClassification["dimensions"]): string {
  const fields = dimensions.map(d => `    "${d.key}": "<strongly_positive|positive|neutral|negative|strongly_negative>"`).join(",\n");
  return `"stances": {\n${fields}\n  }`;
}

export function buildPersonaReviewPrompt(
  persona: Persona,
  project: ProjectParsedData,
  rawInput: string,
  dimensions?: TopicClassification["dimensions"],
  mode?: "product" | "topic"
): { system: string; prompt: string } {
  let dimensionsInstruction: string;
  let scoresSchema: string;

  if (dimensions && mode === "topic") {
    dimensionsInstruction = buildStanceInstruction(dimensions);
    scoresSchema = buildStanceSchema(dimensions);
  } else if (dimensions) {
    dimensionsInstruction = buildDynamicNumericInstruction(dimensions);
    scoresSchema = buildDynamicNumericSchema(dimensions);
  } else {
    dimensionsInstruction = buildDynamicNumericInstruction([
      { key: "usability", label_en: "Usability", label_zh: "可用性", description: "How easy to use or practical to implement" },
      { key: "market_fit", label_en: "Market Fit", label_zh: "市场契合", description: "Product-market fit or relevance to target audience" },
      { key: "design", label_en: "Design", label_zh: "设计", description: "Visual/UX design quality or structural quality" },
      { key: "tech_quality", label_en: "Tech Quality", label_zh: "技术质量", description: "Technical implementation quality or feasibility" },
      { key: "innovation", label_en: "Innovation", label_zh: "创新性", description: "How novel or original in its domain" },
      { key: "pricing", label_en: "Pricing", label_zh: "定价", description: "Value proposition or cost-effectiveness" },
    ]);
    scoresSchema = buildDynamicNumericSchema([
      { key: "usability", label_en: "", label_zh: "", description: "" },
      { key: "market_fit", label_en: "", label_zh: "", description: "" },
      { key: "design", label_en: "", label_zh: "", description: "" },
      { key: "tech_quality", label_en: "", label_zh: "", description: "" },
      { key: "innovation", label_en: "", label_zh: "", description: "" },
      { key: "pricing", label_en: "", label_zh: "", description: "" },
    ]);
  }

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
