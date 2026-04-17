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

const NEUTRAL_FALLBACK_DIMENSIONS: TopicClassification["dimensions"] = [
  { key: "overall_merit", label_en: "Overall Merit", label_zh: "整体价值", description: "How compelling or worthwhile the core proposition is on its own terms" },
  { key: "feasibility", label_en: "Feasibility", label_zh: "可行性", description: "How realistically the topic can be executed, implemented, or adopted given the constraints described" },
  { key: "stakeholder_impact", label_en: "Stakeholder Impact", label_zh: "利益相关方影响", description: "Effect on the people, groups, or audience the topic is intended to serve or affect" },
  { key: "risk", label_en: "Risks", label_zh: "风险", description: "Downside scenarios, failure modes, or unintended consequences worth flagging" },
  { key: "distinctiveness", label_en: "Distinctiveness", label_zh: "独特性", description: "How much it differs from existing alternatives or the status quo" },
  { key: "clarity", label_en: "Clarity", label_zh: "清晰度", description: "How clearly the topic's purpose, mechanism, and success criteria are articulated" },
];

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
    dimensionsInstruction = buildDynamicNumericInstruction(NEUTRAL_FALLBACK_DIMENSIONS);
    scoresSchema = buildDynamicNumericSchema(NEUTRAL_FALLBACK_DIMENSIONS);
  }

  const system = `${persona.system_prompt}

You are providing your perspective on a topic submitted for discussion. The topic could be a product, idea, policy, event, design, creative work, business strategy, or anything else. Stay completely in character. Your evaluation should reflect your unique perspective, biases, blind spots, and emotional reactions as defined in your character.

IMPORTANT EVALUATION RULES:
${dimensionsInstruction}
- Your scoring should reflect your scoring_weights — dimensions you care about more should have more detailed analysis.
- CITATION MINIMUMS (hard requirements, not suggestions):
  * Your review_text must contain AT LEAST 3 verbatim quotes from the user's submission. Wrap each quote in double quotes. Use the user's exact wording, including numbers, names, and specific phrases — do not paraphrase and then call it a quote.
  * Your "cited_references" array must have AT LEAST 2 entries. Each entry must pair a specific factual claim you made with a source (study, report, benchmark, publication, dataset, case study, or "personal experience in <role/industry>" when you are speaking from lived experience as your character).
  * "strengths" and "weaknesses" arrays must each contain AT LEAST 3 items, and every item must name a specific element from the submission (a feature, number, phrase, mechanism, constraint). No generic entries like "good concept" or "needs work".
- BANNED PHRASES (rewrite if they appear in your draft): "has potential", "could be better", "interesting idea", "well thought out", "needs more work", "solid foundation", "great start", "overall good", "many possibilities", "promising direction". If a sentence relies on one of these phrases, it is too vague — rewrite it around a specific quote or number.
- Your review MUST include CONCRETE DATA: statistics, market sizes, research findings, industry benchmarks, prices, dates, adoption rates, failure rates, or case studies that support your analysis. For example, instead of "the market is competitive", say "the CRM market reached $58B in 2023 (Gartner), dominated by Salesforce at 23% share — entering without a clear wedge is risky."
- If something triggers your known biases or blind spots, let that show naturally through the voice, not through a meta-comment.
- React to the topic the way you would in real life based on your contextual_behaviors.
- If the submission includes a document (resume, report, proposal, etc.), your review MUST cite at least two specific sections or bullet points from that document — not just "the user uploaded a resume".

EXAMPLE — bad review_text (do NOT write this):
"This is an interesting SaaS idea with potential. The pricing seems reasonable and the target audience is well-defined. There's some competition but the product has a decent chance in the market. Overall, a solid start that could become a strong player with more refinement."
Why it fails: zero quotes, zero numbers, zero named competitors, uses banned phrases ("interesting", "potential", "solid start"), nothing in this review would change if the user had submitted a completely different SaaS.

EXAMPLE — good review_text (this is the bar):
"The $49/month price point the user calls 'affordable for indie founders' actually sits above Linear's $8 and Notion's $10 starter tiers — I'd argue 'affordable' is a stretch. The claim that '80% of freelancers already use three tools daily' is exactly the wedge I'd lean on: the pitch should be consolidation, not a new category. I'm nervous about the 'zero-training onboarding' promise — Asana tried that in 2019 and churn at day 30 still hit 40% (TechCrunch). If the user wants 'sub-5% monthly churn' as a success metric, they need to show me the activation milestone, not just the signup flow."
Why it works: three direct quotes, three numbers, two named competitors, one benchmark with source, a concrete pushback on a stated success metric.

IMPORTANT: Always respond in English regardless of the input language. Your review_text, strengths, and weaknesses must all be in English. Keep proper nouns in the user's original spelling.

Respond ONLY with valid JSON in this exact format:
{
  ${scoresSchema},
  "overall_stance": "<strongly_positive|positive|neutral|negative|strongly_negative>",
  "review_text": "<Your detailed review, 300-500 words, first person as your character. Must include at least 3 verbatim quotes from the submission and at least 2 concrete data points/benchmarks.>",
  "strengths": ["<specific strength citing a submission element>", "<...>", "<at least 3 entries>"],
  "weaknesses": ["<specific weakness citing a submission element>", "<...>", "<at least 3 entries>"],
  "cited_references": [
    { "claim": "<specific factual claim you made>", "source": "<data source, study, benchmark, case study, or lived experience>" },
    { "claim": "<another claim>", "source": "<another source>" }
  ]
}`;

  const prompt = `Please provide your perspective on this topic:

**Topic:** ${project.name}
**Description:** ${project.description}
**Target Audience / Stakeholders:** ${project.target_users}
**Alternatives / Comparables:** ${project.competitors}
**Goals:** ${project.goals}
**Success Metrics:** ${project.success_metrics}

**Original user description (this is the canonical source for your quotes):**
${rawInput}`;

  return { system, prompt };
}
