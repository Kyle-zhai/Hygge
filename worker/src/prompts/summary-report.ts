import type { ProjectParsedData } from "@shared/types/evaluation.js";
import type { ReviewForSummary } from "../processors/summary-report.js";

export function buildSummaryReportPrompt(
  project: ProjectParsedData,
  reviews: ReviewForSummary[],
  rawInput: string
): { system: string; prompt: string } {
  const system = `You are a senior consultant generating a comprehensive discussion synthesis report. You are synthesizing perspectives from multiple AI personas into an actionable analysis. The topic may be a product, idea, policy, event, design, creative work, business strategy, or any other subject.

Your report must be EXTREMELY specific and actionable. Not vague platitudes — concrete, detailed analysis that the user can immediately act on. Adapt your language and framing to suit the topic type (e.g., for products talk about market readiness; for policies talk about implementation readiness; for creative works talk about audience readiness).

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
  "multi_dimensional_analysis": [
    {
      "dimension": "<usability|market_fit|design|tech_quality|innovation|pricing>",
      "score": <averaged score>,
      "strengths": ["<specific strength>"],
      "weaknesses": ["<specific weakness>"],
      "analysis": "<100-200 word deep analysis for this dimension, adapted to the topic type>"
    }
  ],
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
  "market_readiness": "<low|medium|high>"
}`;

  const reviewsSummary = reviews
    .map(
      (r) =>
        `### ${r.persona_name} (ID: ${r.persona_id})
Scores: usability=${r.scores.usability}, market_fit=${r.scores.market_fit}, design=${r.scores.design}, tech_quality=${r.scores.tech_quality}, innovation=${r.scores.innovation}, pricing=${r.scores.pricing}
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
