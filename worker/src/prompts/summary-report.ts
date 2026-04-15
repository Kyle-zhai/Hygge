import type { ProjectParsedData, TopicClassification } from "../types/evaluation.js";
import type { ReviewForSummary } from "../processors/summary-report.js";

function buildNumericDimensionSchema(dimensions: TopicClassification["dimensions"]): string {
  const keys = dimensions.map(d => d.key).join("|");
  return `"multi_dimensional_analysis": [
    {
      "dimension": "<${keys}>",
      "label_en": "<English label for this dimension>",
      "label_zh": "<Chinese label for this dimension>",
      "score": <averaged score 1-10>,
      "strengths": ["<specific strength>"],
      "weaknesses": ["<specific weakness>"],
      "analysis": "<100-200 word deep analysis for this dimension>"
    }
  ]`;
}

function buildStanceDimensionSchema(dimensions: TopicClassification["dimensions"]): string {
  const keys = dimensions.map(d => d.key).join("|");
  return `"multi_dimensional_analysis": [
    {
      "dimension": "<${keys}>",
      "label_en": "<English label for this dimension>",
      "label_zh": "<Chinese label for this dimension>",
      "overall_leaning": "<strongly_positive|positive|neutral|negative|strongly_negative>",
      "positive_count": <number of personas with positive or strongly_positive>,
      "negative_count": <number of personas with negative or strongly_negative>,
      "neutral_count": <number of personas with neutral>,
      "key_arguments": {
        "positive": "<main arguments from personas leaning positive>",
        "negative": "<main arguments from personas leaning negative>"
      },
      "analysis": "<100-200 word deep analysis for this dimension>"
    }
  ]`;
}

function buildScoresLine(review: ReviewForSummary, dimensions?: TopicClassification["dimensions"]): string {
  if (dimensions) {
    return "Scores: " + dimensions.map(d => `${d.key}=${(review.scores as Record<string, number>)[d.key] ?? "N/A"}`).join(", ");
  }
  const s = review.scores as Record<string, number>;
  return "Scores: " + Object.entries(s).map(([k, v]) => `${k}=${v}`).join(", ");
}

export function buildTopicSummaryReportPrompt(
  project: ProjectParsedData,
  reviews: ReviewForSummary[],
  rawInput: string,
  dimensions: TopicClassification["dimensions"]
): { system: string; prompt: string } {
  const dimensionSchema = buildStanceDimensionSchema(dimensions);

  const system = `You are synthesizing a multi-perspective discussion on a topic. Multiple AI personas with different backgrounds have independently shared their views. Your job is to produce a comprehensive synthesis report.

═══════════════════════════════════════════════
CONTENT QUALITY REQUIREMENTS (apply to EVERY text field and array item)
═══════════════════════════════════════════════

1. PERSONA VOICE — every recommendation, risk, next step, and modification must be grounded in a specific persona's stated view. Attribute explicitly: "{PersonaName} argued...", "Following {PersonaName}'s concern about {the exact concern they raised}, ...", "Per {PersonaName}'s point that {X}, ...". Never use anonymous voice like "the team thinks" or "experts say".

2. TIE TO THE USER'S SUBMISSION — reference the topic's actual name, description, stated goals, success metrics, target users, or comparables (by exact wording) where relevant. If the user named a feature, price point, timeline, or competitor, quote it. Do not invent details not present in the submission or persona reviews.

3. REAL-WORLD GROUNDING — when citing comparable cases, companies, products, studies, industry benchmarks, or historical precedents, name them specifically from your training knowledge (e.g., "Figma's browser-first pivot", "Stripe's iterative launch in 7 countries before global", "the 2023 EU AI Act's risk-tier framework"). Only cite what you are confident is real. If you are not sure a specific reference exists, describe the pattern without fabricating a name. NEVER invent studies, reports, or company initiatives.

4. NO PLATITUDES — banned phrases and any variant of them: "improve marketing", "gather more user feedback", "build community", "enhance user experience", "iterate based on data", "refine messaging", "explore partnerships", "leverage synergies", "prioritize quality", "focus on growth". If a sentence could apply to ANY topic, rewrite it with specifics. If you cannot think of something specific, say fewer words — brevity beats fluff.

5. CONSENSUS SCORE — consensus_score (0-100) measures how much the personas agree: 0 = completely divergent views, 100 = total agreement. Base this on their actual positions, not their numeric scores. If there is only ONE persona, consensus_score MUST be 100.

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
      { "point": "<what they agree on>", "supporting_personas": ["<id1>", "<id2>"] }
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
  "readiness_label_zh": "<Chinese translation of the contextual label above>",
  "positions": {
    "question": "<restate the core question/topic being debated in one sentence>",
    "positive_label": "<short label for the green/positive side, e.g. 'In favor of launching at $20/mo'>",
    "positive_summary": "<1-2 sentence summary of the positive position>",
    "negative_label": "<short label for the red/negative side, e.g. 'Against launching at $20/mo'>",
    "negative_summary": "<1-2 sentence summary of the negative position>"
  },
  "references": [
    {
      "title": "<reference title, e.g. 'SaaS pricing benchmarks 2024'>",
      "detail": "<what this reference says and how it's relevant>",
      "source": "<origin: persona name, study, report, or industry data>",
      "persona_name": "<persona who cited or would cite this, if applicable>"
    }
  ],
  "if_feasible": {
    "next_steps": ["<concrete step to take if this topic/idea/proposal is adopted or moves forward — cite specific persona feedback>"],
    "optimizations": ["<specific refinement that would improve execution if pursued — reference persona concerns>"],
    "risks": ["<specific risk to monitor during execution — tie to a persona's stated concern>"]
  },
  "if_not_feasible": {
    "modifications": ["<specific change needed to make this workable — cite which persona raised the blocker>"],
    "direction": "<recommended pivot or alternative framing if the current direction cannot work>",
    "priorities": ["<what to address first to salvage this — concrete and specific>"],
    "reference_cases": ["<analogous topic/effort that succeeded with the pivoted approach>"]
  }
}

IMPORTANT for debate_highlights:
- Include 2-4 highlights
- Perspectives are NOT limited to pro/con — they can be multiple distinct angles on the same point
- If all personas agree on a point, still include it as a highlight and explain the consensus and its significance
- Each persona's stance should capture their unique angle, not just "agrees" or "disagrees"

CRITICAL for if_feasible and if_not_feasible:
- BOTH paths MUST be fully populated regardless of market_readiness. The user sees both scenarios side-by-side.
- Each array must contain at least 3 items. No empty arrays. No placeholder text.
- Every item MUST open with attribution to a specific persona and then state the specific move/risk/change. Example format: "Following {PersonaName}'s concern about {exact concern from their review}, {specific action tied to the topic's named feature/goal/metric}."
- Every item must cite AT LEAST ONE of: (a) a specific persona's exact concern or phrasing; (b) a named feature, price, goal, or metric from the user's submission; (c) a real named company/product/study from your training knowledge.
- BANNED: generic advice ("improve communication", "do more research", "gather feedback", "iterate", "build community"). If you catch yourself writing generic text, replace with persona-attributed specifics or omit.
- "reference_cases" entries must be REAL companies/products/initiatives you know from training data, with a one-line reason why the analogy applies. Not "a similar successful pivot" — name it.
- "if_feasible" describes the path assuming the topic IS pursued/adopted. "if_not_feasible" describes what must change OR an alternative direction if the current form cannot succeed.
- Even when you are confident the topic is viable, still fill "if_not_feasible" with the modifications required under the dissenting personas' objections. Even when confident it is not, still fill "if_feasible" with what pursuing anyway would look like.`;

  const reviewsSummary = reviews
    .map(
      (r) =>
        `### ${r.persona_name} (ID: ${r.persona_id})
Stances: ${dimensions.map(d => `${d.key}=${(r.scores as Record<string, string>)[d.key] ?? "N/A"}`).join(", ")}
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
    ? buildNumericDimensionSchema(dimensions)
    : buildNumericDimensionSchema([
        { key: "usability", label_en: "Usability", label_zh: "可用性", description: "" },
        { key: "market_fit", label_en: "Market Fit", label_zh: "市场契合", description: "" },
        { key: "design", label_en: "Design", label_zh: "设计", description: "" },
        { key: "tech_quality", label_en: "Tech Quality", label_zh: "技术质量", description: "" },
        { key: "innovation", label_en: "Innovation", label_zh: "创新性", description: "" },
        { key: "pricing", label_en: "Pricing", label_zh: "定价", description: "" },
      ]);

  const readinessNote = dimensions
    ? `The "market_readiness" field should reflect overall readiness/feasibility for this topic type (low/medium/high). Also include "readiness_label_en" and "readiness_label_zh" fields with a contextually appropriate label.`
    : `The "market_readiness" field reflects market readiness (low/medium/high).`;

  const system = `You are a senior consultant generating a comprehensive discussion synthesis report. You are synthesizing perspectives from multiple AI personas into an actionable analysis. The topic may be a product, idea, policy, event, design, creative work, business strategy, or any other subject.

═══════════════════════════════════════════════
CONTENT QUALITY REQUIREMENTS (apply to EVERY text field and array item)
═══════════════════════════════════════════════

1. PERSONA VOICE — every recommendation, risk, action item, modification, or next step must be grounded in a specific persona's stated view. Attribute explicitly: "{PersonaName} flagged that...", "Building on {PersonaName}'s point about {exact concern}, ...", "To address {PersonaName}'s objection that {X}, ...". Never use anonymous voice like "the team should" or "experts recommend".

2. TIE TO THE USER'S SUBMISSION — reference the product's actual name, described features, stated goals, success metrics, target users, and named competitors from the user's input. If the user wrote that the product targets "early-stage founders" or priced at "$29/mo" or competes with "Notion", quote those exact details. Do not invent features, metrics, or attributes not present in the submission or persona reviews.

3. REAL-WORLD GROUNDING — when citing comparable products, successful pivots, market benchmarks, or case studies, name them specifically from your training knowledge (e.g., "Superhuman's waitlist-driven launch", "Basecamp's move away from VC funding", "Linear's opinionated UX over flexibility"). Only cite what you are confident is real. NEVER invent companies, studies, reports, or funding rounds. If you are not sure a specific reference exists, describe the pattern without fabricating a name.

4. NO PLATITUDES — banned phrases and any variant: "improve your marketing", "gather more feedback", "build community", "enhance UX", "iterate based on data", "refine messaging", "explore partnerships", "leverage synergies", "prioritize quality", "focus on growth". If a sentence could apply to ANY product, rewrite it with specifics. If you cannot think of something specific, say fewer words — brevity beats fluff.

5. ACTIONABILITY — every action_item and feasibility entry must be something the user could start doing this week. State WHAT to do, WHICH persona's concern it addresses, and WHICH feature/metric it touches.

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
      { "point": "<what they agree on>", "supporting_personas": ["<id1>", "<id2>"] }
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
    "modifications": ["<specific modification needed — cite which persona flagged the blocker>"],
    "direction": "<recommended pivot or alternative direction, naming comparables the personas mentioned>",
    "priorities": ["<priority to address first — concrete and tied to a stated gap>"],
    "reference_cases": ["<named analogous case that succeeded with this pivot>"]
  },
  "if_feasible": {
    "next_steps": ["<concrete next step tied to a persona's positive feedback or a specific feature/goal>"],
    "optimizations": ["<specific optimization that would improve an existing part — reference a weakness the personas raised>"],
    "risks": ["<specific risk to monitor — tie to a persona's concern or a dimension weakness>"]
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
}

CRITICAL for if_feasible and if_not_feasible:
- BOTH paths MUST be fully populated regardless of market_readiness. The user sees them side-by-side and needs both scenarios.
- Each array must contain at least 3 items. No empty arrays. No single-item arrays for the main lists.
- Every item MUST open with attribution to a specific persona and then state the specific move/risk/change. Example format: "Addressing {PersonaName}'s concern that {exact concern from review}, {specific action tied to a named feature/goal/metric}."
- Every item must cite AT LEAST ONE of: (a) a specific persona's exact concern or phrasing; (b) a named feature, price, goal, or metric from the user's submission; (c) a real named company/product/study from your training knowledge.
- BANNED: generic advice ("improve marketing", "gather more feedback", "iterate quickly", "build community"). If you catch yourself writing generic text, replace with persona-attributed specifics or omit.
- "reference_cases" entries must be REAL companies/products/initiatives you know from training data, with a one-line reason why the analogy applies. Not "a similar SaaS that pivoted" — name it (e.g., "Slack's pivot from game dev to team chat — validated market need before product").
- "if_feasible" describes what pursuing the product looks like — real next moves, actual optimizations, specific risks.
- "if_not_feasible" describes what must change OR an alternative direction. Fill it even when the product is high-readiness, reflecting the dissenting personas' objections and what would be required to address them.`;

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
