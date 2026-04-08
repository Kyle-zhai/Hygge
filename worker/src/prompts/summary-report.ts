import type { PersonaReview, ProjectParsedData } from "../../shared/types/evaluation.js";

export function buildSummaryReportPrompt(
  project: ProjectParsedData,
  reviews: (PersonaReview & { persona_name: string })[],
  rawInput: string
): { system: string; prompt: string } {
  const system = `You are a senior product consultant generating a comprehensive evaluation report. You are synthesizing evaluations from multiple AI personas into an actionable product diagnosis.

Your report must be EXTREMELY specific and actionable. Not vague platitudes — concrete, detailed analysis that a developer can immediately act on.

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
      "analysis": "<100-200 word deep analysis for this dimension>"
    }
  ],
  "goal_assessment": [
    {
      "goal": "<user's stated goal>",
      "achievable": <true|false>,
      "current_status": "<where the product stands relative to this goal>",
      "gaps": ["<specific gap>"]
    }
  ],
  "if_not_feasible": {
    "modifications": ["<specific modification>"],
    "direction": "<recommended pivot direction>",
    "priorities": ["<priority 1>", "<priority 2>"],
    "reference_cases": ["<similar product that succeeded with this approach>"]
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

  const prompt = `Generate a comprehensive evaluation report for this project.

## Project Information
**Name:** ${project.name}
**Description:** ${project.description}
**Target Users:** ${project.target_users}
**Competitors:** ${project.competitors}
**Goals:** ${project.goals}
**Success Metrics:** ${project.success_metrics}

**Original description:** ${rawInput}

## Individual Persona Reviews

${reviewsSummary}

Generate the comprehensive summary report. Be EXTREMELY specific and actionable.`;

  return { system, prompt };
}
