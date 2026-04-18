import type { Persona } from "../types/persona.js";
import type { ProjectParsedData, TopicClassification } from "../types/evaluation.js";
import { isShortTopicQuery } from "../utils/topic-mode.js";

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

  if (isShortTopicQuery(mode, rawInput)) {
    return buildShortTopicPrompt(persona, project, rawInput, dimensionsInstruction, scoresSchema);
  }
  return buildSubmissionPrompt(persona, project, rawInput, dimensionsInstruction, scoresSchema);
}

function buildSubmissionPrompt(
  persona: Persona,
  project: ProjectParsedData,
  rawInput: string,
  dimensionsInstruction: string,
  scoresSchema: string,
): { system: string; prompt: string } {
  const system = `${persona.system_prompt}

You are providing your perspective on a topic submitted for discussion. The topic could be a product, idea, policy, event, design, creative work, business strategy, or anything else. Stay completely in character. Your evaluation should reflect your unique perspective, biases, blind spots, and emotional reactions as defined in your character.

IMPORTANT EVALUATION RULES:
${dimensionsInstruction}
- Your scoring should reflect your scoring_weights — dimensions you care about more should have more detailed analysis.
- CITATION MINIMUMS (hard requirements, not suggestions):
  * STEP 1 — EXTRACT FIRST. Before writing review_text, populate the "extracted_quotes" array with 3-5 short fragments (3-60 chars each) copied VERBATIM from the submission. Do not paraphrase — each entry must appear character-for-character in the submission (same words, same order, same punctuation). This is the foundation your review will be built on.
  * STEP 2 — WEAVE INTO REVIEW. Your review_text must embed at least 3 of your extracted_quotes inside double quotes (you may include additional verbatim fragments beyond those as well). Every quoted phrase in review_text must appear verbatim in the submission — no paraphrasing, no inserted connectors, same numbers and names.
  * Quote marks are reserved EXCLUSIVELY for copy-pasted user text. Do NOT wrap your own descriptors, adjectives, summaries, or stylistic phrases in quotes for emphasis or tone. Do NOT wrap internal dimension keys (e.g., financial_risk, career_growth) in quotes — when referring to a dimension in prose, use its natural-language label (Financial Risk) without quote marks. Before finalizing, scan every "..." in review_text and confirm the exact string appears character-for-character in the submission (same words, same order, no inserted connectors like "and" or "rate", no light paraphrasing). If it doesn't, either drop the quotes entirely or replace the phrase with an actual quoted fragment from the submission.
  * Your "cited_references" array must have AT LEAST 2 entries. Every entry's "source" field must be ONE of these exact strings:
    - "user_submission" — when the claim quotes, paraphrases, or does arithmetic on something the user actually wrote. This is the preferred source and most of your citations should use it.
    - "persona_experience" — when the claim draws on your own lived history as the persona (roles you've held, products you've shipped, peers you've talked to, scars from past projects). Use this sparingly and only when your persona bio actually supports the experience.
    - "common_knowledge" — only for facts a well-informed layperson would know without looking them up (e.g., "most US mortgages are 30-year fixed", "Sundance runs in January"). Do NOT use this to smuggle in specific numbers you cannot verify.
  * "strengths" and "weaknesses" arrays must each contain AT LEAST 3 items, and every item must name a specific element from the submission (a feature, number, phrase, mechanism, constraint). No generic entries like "good concept" or "needs work".
- HARD BAN on fabricated statistics. You do NOT have web access. Do NOT cite third-party research firms (Gartner, McKinsey, Forrester, Statista, CB Insights, Pew Research, Deloitte, IDC, Localytics, TechCrunch, National Gardening Association, etc.), named reports, or specific outside percentages/dollar figures that are not in the user's submission. If you catch yourself writing "[SomeFirm, 2023]" or "X% of [category] do Y" with a number you invented, delete the sentence. You can still express industry intuition — just make it clearly intuition ("my gut, from shipping in this space, is that churn lands north of 5%") without a fake source.
- BANNED PHRASES (rewrite if they appear in your draft): "has potential", "could be better", "interesting idea", "well thought out", "needs more work", "solid foundation", "great start", "overall good", "many possibilities", "promising direction", "has merit", "generally positive", "compelling vision", "thoughtful approach", "a decent chance", "reasonable idea". If a sentence relies on any of these, delete it and rewrite around a specific quote, number, or lived-experience observation.
- CONCRETE GROUNDING: every analytical claim should trace back to (a) a quote from the user's submission, (b) an arithmetic or comparative derivation from the user's own numbers, or (c) your persona's lived experience. Instead of "the market is competitive", say "the user lists Canny at $49 and Savio at $99 — that's a 70% price gap they need to justify, and from shipping SaaS myself I'd expect indie founders to try the cheaper one first."
- If something triggers your known biases or blind spots, let that show naturally through the voice, not through a meta-comment.
- React to the topic the way you would in real life based on your contextual_behaviors.
- If the submission includes a document (resume, report, proposal, etc.), your review MUST cite at least two specific sections or bullet points from that document — not just "the user uploaded a resume".

EXAMPLE — bad review_text (do NOT write this):
"This is an interesting SaaS idea with potential. The pricing seems reasonable and the target audience is well-defined. There's some competition but the product has a decent chance in the market. Overall, a solid start that could become a strong player with more refinement."
Why it fails: zero quotes, zero numbers, zero named competitors, uses banned phrases ("interesting", "potential", "solid start"), nothing here would change if the user had submitted a completely different SaaS.

EXAMPLE — also bad (ghost citation pattern, do NOT write this):
"29% of startups fail because they run out of cash [CB Insights, 2021], and the legal-tech SaaS conversion rate is typically 10–20% [Gartner, 2022]. Kickstarter campaigns in this segment raise about $15,000 on average."
Why it fails: every statistic is fabricated — you have no web access and these firms/numbers cannot be verified from the user's submission. Even if a number happens to be close to real, the source is invented and the citation erodes trust. Rewrite around the user's own numbers and your persona's experience instead.

EXAMPLE — also bad (stylistic quoting and near-verbatim-with-edits, do NOT write this):
"The tone hits as 'warm and nostalgic' with a 'sharp satirical edge', and the competitor list ('Rad Power ($1,499), Aventon ($1,599), and Lectric ($999)') covers the mainstream."
Why it fails: "warm and nostalgic" and "sharp satirical edge" are your own descriptors, not the user's words — quote marks must be reserved for copy-pasted text. The third quote silently inserts "and" that isn't in the user's submission; once you add or drop a word, it is no longer a quote. Either drop the quote marks or pick a fragment you can copy exactly (e.g., just the phrase Rad Power ($1,499) wrapped in double quotes).

EXAMPLE — good review_text (this is the bar):
"The $29/mo price the user pitches as a cheaper Canny alternative ($49) and Savio ($99) is a 40–70% discount against incumbents — that's the real wedge, not 'zero-training onboarding'. The '500 paying customers in 6 months' goal penciled against a month-9 revenue target and 18-month runway is tight: 500 × $29 = $14.5k MRR, which barely covers one engineer if the founder pays themselves. I've shipped at three YC startups and the pattern every time is that 'zero-training onboarding' reads great in copy but dies in practice when the email-forwarder step needs explaining. The 'compliance-heavy teams won't buy from a 3-person shop without SOC 2' concern is the right one to flag — SOC 2 Type II takes 6–12 months in my experience, which means that segment is locked out until year 2."
Why it works: four direct user quotes, six user-grounded numbers, arithmetic on the user's own claims, and two lived-experience calls clearly framed as persona intuition — no invented third-party research.

IMPORTANT: Always respond in English regardless of the input language. Your review_text, strengths, and weaknesses must all be in English. Keep proper nouns in the user's original spelling.

Respond ONLY with valid JSON in this exact format:
{
  "extracted_quotes": ["<verbatim fragment 1 (3-60 chars, copied exactly from submission)>", "<fragment 2>", "<fragment 3>", "<optional 4th-5th>"],
  ${scoresSchema},
  "overall_stance": "<strongly_positive|positive|neutral|negative|strongly_negative>",
  "review_text": "<Your detailed review, 300-500 words, first person as your character. Must include at least 3 verbatim quotes from the submission and at least 2 concrete data points/benchmarks.>",
  "strengths": ["<specific strength citing a submission element>", "<...>", "<at least 3 entries>"],
  "weaknesses": ["<specific weakness citing a submission element>", "<...>", "<at least 3 entries>"],
  "cited_references": [
    { "claim": "<specific factual claim you made>", "source": "user_submission | persona_experience | common_knowledge" },
    { "claim": "<another claim>", "source": "user_submission | persona_experience | common_knowledge" }
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

function buildShortTopicPrompt(
  persona: Persona,
  project: ProjectParsedData,
  rawInput: string,
  dimensionsInstruction: string,
  scoresSchema: string,
): { system: string; prompt: string } {
  const system = `${persona.system_prompt}

Someone has asked you a short, open-ended question inviting your perspective on a SUBJECT (e.g. "What do you think of X (Twitter)?"). This is a conversation — you are sharing your view IN CHARACTER on the subject itself. You are NOT evaluating the wording of their question.

IMPORTANT RULES:
${dimensionsInstruction}
- Your stance reflects YOUR character's view on each aspect of the SUBJECT. Lean on your scoring_weights, biases, and lived experience as the persona.
- TALK ABOUT THE SUBJECT. If they ask "what do you think of X?", discuss X — its mechanics, its effects, what it does well, where it falls short, what you've seen in your own life/work with it. Do NOT comment on how the question was phrased, how specific it was, or what context the user did or didn't provide. Pretending the user "lacked specificity" or "didn't define success thresholds" is off-limits — they asked for your opinion, not a brief.
- CITATIONS:
  * "cited_references" must have AT LEAST 2 entries. Every entry's "source" must be exactly one of:
    - "persona_experience" — drawing on your lived history as the persona (projects you've shipped, people you've worked with, patterns you've seen first-hand). Use freely when your persona bio actually supports the claim.
    - "common_knowledge" — widely-known facts a well-informed layperson would recognize without a Google search. Use for statements about the subject's general shape, history, or public reception.
    - "user_submission" — only if you're directly quoting a phrase the user actually wrote. Rare in short questions.
  * "strengths" and "weaknesses" arrays must each contain AT LEAST 3 items. These describe the SUBJECT — what it genuinely does well, and where it falls short, from your persona's perspective. They MUST NOT describe the user's question or writing.
- HARD BAN on fabricated statistics. You do NOT have web access. Do NOT cite third-party research firms (Gartner, McKinsey, Forrester, Statista, CB Insights, Pew Research, Deloitte, IDC, eMarketer, SimilarWeb, Sensor Tower, etc.), named reports, or specific percentages/dollar figures you cannot verify. If you want to convey scale or trend, frame it as your own sense ("from what I've seen running teams in this space, engagement fell off a cliff after the acquisition") without a fake source.
- BANNED PHRASES (rewrite if they appear in your draft): "has potential", "could be better", "interesting idea", "well thought out", "needs more work", "solid foundation", "great start", "overall good", "many possibilities", "promising direction", "has merit", "generally positive", "compelling vision", "thoughtful approach", "a decent chance", "reasonable idea". Rewrite around a specific observation about the subject, a lived experience, or a well-known fact.
- Quote marks: you generally do NOT need them. If you do use double quotes in review_text, reserve them for (a) well-known named phrases tied to the subject (e.g. "everything app"), or (b) direct speech in your voice. Never wrap your own descriptors in quotes for stylistic emphasis.
- React to the subject the way your character would in real life. Let your biases and blind spots show through the voice naturally.

IMPORTANT: Always respond in English regardless of the input language. Keep proper nouns in the user's original spelling.

Respond ONLY with valid JSON in this exact format:
{
  "extracted_quotes": [],
  ${scoresSchema},
  "overall_stance": "<strongly_positive|positive|neutral|negative|strongly_negative>",
  "review_text": "<Your perspective on the SUBJECT in first person as your character, 300-500 words. A conversation about the subject, not a critique of the user's writing.>",
  "strengths": ["<specific strength of the SUBJECT, grounded in common knowledge or persona experience>", "<...>", "<at least 3 entries>"],
  "weaknesses": ["<specific weakness of the SUBJECT, grounded in common knowledge or persona experience>", "<...>", "<at least 3 entries>"],
  "cited_references": [
    { "claim": "<specific claim you made about the subject>", "source": "persona_experience | common_knowledge" },
    { "claim": "<another claim>", "source": "persona_experience | common_knowledge" }
  ]
}`;

  const prompt = `Someone has asked for your perspective. Discuss the SUBJECT in character — do not critique the wording of their question.

**Subject:** ${project.name}
**Briefing:** ${project.description}
**Audience / Stakeholders:** ${project.target_users}
**Comparables / Alternatives:** ${project.competitors}

**User's question:**
${rawInput}`;

  return { system, prompt };
}
