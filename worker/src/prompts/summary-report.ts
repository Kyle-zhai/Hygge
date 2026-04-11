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

export function buildTopicSummaryReportPrompt(
  project: ProjectParsedData,
  reviews: ReviewForSummary[],
  rawInput: string,
  dimensions: TopicClassification["dimensions"]
): { system: string; prompt: string } {
  const dimensionSchema = buildDynamicDimensionSchema(dimensions);

  const system = `You are synthesizing a multi-perspective discussion on a topic. Multiple AI personas with different backgrounds have independently shared their views. Your job is to produce a comprehensive synthesis report.

CRITICAL RULES:
- Every claim must reference SPECIFIC details from the personas' reviews. No generic platitudes.
- The synthesis should directly answer the user's topic/question with a substantive, well-reasoned conclusion.
- The consensus_score (0-100) measures how much the personas agree: 0 = completely divergent views, 100 = total agreement. Evaluate based on their actual positions, not just their scores. If there is only ONE persona, consensus_score MUST be 100 since there is no disagreement possible.

IMPORTANT: Always respond in English regardless of the input language. All text fields must be in English.

Respond ONLY with valid JSON matching this structure:
{
  "consensus_score": <0-100 integer>,
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
  "synthesis": "<500-800 word substantive conclusion that directly answers the user's topic. Synthesize all persona perspectives into a cohesive, actionable answer. Write like a senior consultant delivering a final verdict after hearing all sides.>",
  "debate_highlights": [
    {
      "topic": "<the discussion point>",
      "perspectives": [
        { "persona_name": "<name>", "stance": "<their specific position on this point>" }
      ],
      "significance": "<why this point matters and what insight it reveals>"
    }
  ],
  "market_readiness": "<low|medium|high>",
  "readiness_label_en": "<contextual label that fits the topic type — e.g. 'Implementation Readiness' for policies, 'Feasibility' for ideas, 'Decision Clarity' for decisions, 'Creative Potential' for creative works. NEVER use 'Market Readiness' unless the topic is actually about a product/market.>",
  "readiness_label_zh": "<Chinese translation of the contextual label above>"
}

IMPORTANT for debate_highlights:
- Include 2-4 highlights
- Perspectives are NOT limited to pro/con — they can be multiple distinct angles on the same point
- If all personas agree on a point, still include it as a highlight and explain the consensus and its significance
- Each persona's stance should capture their unique angle, not just "agrees" or "disagrees"`;

  const reviewsSummary = reviews
    .map(
      (r) =>
        `### ${r.persona_name} (ID: ${r.persona_id})
Scores: ${dimensions.map(d => `${d.key}=${(r.scores as Record<string, number>)[d.key] ?? "N/A"}`).join(", ")}
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

Generate the synthesis report. Be EXTREMELY specific — cite persona names and their exact points.`;

  return { system, prompt };
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

CRITICAL: Every claim in your report must reference SPECIFIC details from the personas' reviews and the original submission. Do NOT produce generic advice like "improve your marketing" — instead say exactly WHAT to improve, WHY (citing persona feedback), and HOW. If personas referenced specific features, data points, or content from the submission, carry those references into your synthesis.

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
