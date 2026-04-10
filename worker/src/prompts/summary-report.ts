import type { ProjectParsedData, TopicClassification } from "../types/evaluation.js";
import type { ReviewForSummary } from "../processors/summary-report.js";

const FIXED_DIMENSION_SCHEMA = `"multi_dimensional_analysis": [
    {
      "dimension": "<usability|market_fit|design|tech_quality|innovation|pricing>",
      "score": <averaged score>,
      "strengths": ["<specific strength>"],
      "weaknesses": ["<specific weakness>"],
      "analysis": "<100-200 word deep analysis for this dimension, adapted to the topic type>"
    }
  ]`;

function buildDynamicDimensionSchema(dimensions: TopicClassification["dimensions"]): string {
  const keys = dimensions.map(d => d.key).join("|");
  return `"multi_dimensional_analysis": [
    {
      "dimension": "<${keys}>",
      "label_en": "<English label for this dimension>",
      "label_zh": "<Chinese label for this dimension>",
      "score": <averaged score>,
      "strengths": ["<specific strength>"],
      "weaknesses": ["<specific weakness>"],
      "analysis": "<100-200 word deep analysis for this dimension>"
    }
  ]`;
}

function buildScoresLine(review: ReviewForSummary, dimensions?: TopicClassification["dimensions"]): string {
  if (dimensions) {
    return "Scores: " + dimensions.map(d => `${d.key}=${(review.scores as Record<string, number>)[d.key] ?? "N/A"}`).join(", ");
  }
  const s = review.scores as Record<string, number>;
  return `Scores: usability=${s.usability}, market_fit=${s.market_fit}, design=${s.design}, tech_quality=${s.tech_quality}, innovation=${s.innovation}, pricing=${s.pricing}`;
}

export function buildSummaryReportPrompt(
  project: ProjectParsedData,
  reviews: ReviewForSummary[],
  rawInput: string,
  dimensions?: TopicClassification["dimensions"]
): { system: string; prompt: string } {
  const dimensionSchema = dimensions
    ? buildDynamicDimensionSchema(dimensions)
    : FIXED_DIMENSION_SCHEMA;

  const readinessNote = dimensions
    ? `The "market_readiness" field should reflect overall readiness/feasibility for this topic type (low/medium/high). Also include "readiness_label_en" and "readiness_label_zh" fields with a contextually appropriate label.`
    : `The "market_readiness" field reflects market readiness (low/medium/high).`;

  const system = `You are a senior consultant generating a comprehensive discussion synthesis report. You are synthesizing perspectives from multiple AI personas into an actionable analysis. The topic may be a product, idea, policy, event, design, creative work, business strategy, or any other subject.

Your report must be EXTREMELY specific and actionable. Not vague platitudes — concrete, detailed analysis that the user can immediately act on. Adapt your language and framing to suit the topic type.

${readinessNote}

IMPORTANT: Always respond in English regardless of the input language. All text fields must be in English.

Respond ONLY with valid JSON matching this structure:
{
  "overall_score": <1-10, one decimal>,
  "persona_analysis": {
    "entries": [
      {
        "persona_id": "<id>",
        "persona_name": "<name>",
        "core_viewpoint": "<2-3 sentence summary of this persona's key takeaway>",
        "scoring_rationale": "<why they scored the way they did>"
      }
    ],
    "consensus": [
      { "point": "<what they agree on>", "supporting_personas": ["<name1>", "<name2>"] }
    ],
    "disagreements": [
      {
        "point": "<what they disagree on>",
        "sides": [
          { "persona_ids": ["<id>"], "position": "<their stance>" }
        ],
        "reason": "<why they disagree>"
      }
    ]
  },
  ${dimensionSchema},
  "goal_assessment": [
    {
      "goal": "<user's stated goal>",
      "achievable": <true|false>,
      "current_status": "<where the topic stands relative to this goal>",
      "gaps": ["<specific gap>"]
    }
  ],
  "if_not_feasible": {
    "modifications": ["<specific modification>"],
    "direction": "<recommended pivot or alternative direction>",
    "priorities": ["<priority 1>", "<priority 2>"],
    "reference_cases": ["<similar topic/effort that succeeded with this approach>"]
  },
  "if_feasible": {
    "next_steps": ["<specific next step>"],
    "optimizations": ["<specific optimization>"],
    "risks": ["<specific risk>"]
  },
  "action_items": [
    {
      "description": "<specific action>",
      "priority": "<critical|high|medium|low>",
      "expected_impact": "<what this will improve>",
      "difficulty": "<easy|medium|hard>"
    }
  ],
  "market_readiness": "<low|medium|high>"${dimensions ? `,
  "readiness_label_en": "<contextual readiness label in English>",
  "readiness_label_zh": "<contextual readiness label in Chinese>"` : ""}
}`;

  const reviewsSummary = reviews
    .map(
      (r) =>
        `### ${r.persona_name} (ID: ${r.persona_id})
${buildScoresLine(r, dimensions)}
Review: ${r.review_text}
Strengths: ${r.strengths.join(", ")}
Weaknesses: ${r.weaknesses.join(", ")}`
    )
    .join("\n\n");

  const prompt = `Generate a comprehensive discussion synthesis report for this topic.

## Topic Information
**Name:** ${project.name}
**Description:** ${project.description}
**Target Audience / Stakeholders:** ${project.target_users}
**Alternatives / Comparables:** ${project.competitors}
**Goals:** ${project.goals}
**Success Metrics:** ${project.success_metrics}

**Original description:** ${rawInput}

## Individual Persona Perspectives

${reviewsSummary}

Generate the comprehensive summary report. Be EXTREMELY specific and actionable.`;

  return { system, prompt };
}
