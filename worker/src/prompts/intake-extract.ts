// Prompt for routing-field extraction. Used by Intake Agent on every user
// message to refresh the routing_extract before deciding whether to ask
// another question or finalize the Brief.

export const INTAKE_EXTRACT_PROMPT_VERSION = "intake-extract-v1";

export const INTAKE_EXTRACT_SYSTEM = `You read a user's decision question and any clarifying answers, and produce a structured extraction of fields needed to route the analysis.

Output strict JSON matching this shape (no prose, no markdown fences):

{
  "canonical_question": "<one-sentence cleaned version of the user's decision question>",
  "fields": {
    "decision_type":      { "value": "tradeoff|build_or_kill|hire|pivot|feature_design|vendor_selection|other", "confidence": 0..1, "source_quote": "<verbatim user-text quote that supports this, or null>" },
    "primary_dimensions": { "value": ["technical"|"business"|"ux"|"strategic"|"people"|"finance", ...], "confidence": 0..1, "source_quote": ... },
    "timeline":           { "value": "immediate|weeks|months|years",       "confidence": 0..1, "source_quote": ... },
    "reversibility":      { "value": "one_way_door|two_way_door|unknown",  "confidence": 0..1, "source_quote": ... },
    "stakes":             { "value": "low|medium|high|unknown",            "confidence": 0..1, "source_quote": ... },
    "stakeholders":       { "value": ["<role or group>", ...],             "confidence": 0..1, "source_quote": ... },
    "persona_hints":      { "value": ["<persona role mentioned>", ...],    "confidence": 0..1, "source_quote": ... },
    "alternatives":       { "value": ["<alternative considered>", ...],    "confidence": 0..1, "source_quote": ... },
    "constraints":        { "value": ["<constraint>", ...],                "confidence": 0..1, "source_quote": ... }
  }
}

Rules:
- "confidence" is your confidence in the extracted value. 0.9+ when the user states it directly. 0.5–0.7 when inferred from context. ≤ 0.3 when guessing.
- "source_quote" must be a verbatim substring from the user's text, or null if you defaulted/guessed.
- For array fields with no clear value, output an empty array with confidence 0.0.
- Do not invent stakeholders, alternatives, or constraints that the user did not mention.
- "primary_dimensions": pick all that the question genuinely requires; do not list more than 3.
- Output only JSON.`;

export function buildExtractUserPrompt(rawUserMessages: string[]): string {
  if (rawUserMessages.length === 1) {
    return `User decision question:\n\n${rawUserMessages[0]}`;
  }
  const numbered = rawUserMessages
    .map((m, i) => `[${i === 0 ? "initial" : `clarification ${i}`}] ${m}`)
    .join("\n\n");
  return `User decision question and clarifications:\n\n${numbered}`;
}
