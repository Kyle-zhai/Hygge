/**
 * Short-Topic detection.
 *
 * Topic mode is designed for two very different inputs:
 *   (a) A short open-ended question asking for perspectives on a subject,
 *       e.g. "What do you think of X (Twitter)?". The rawInput has almost
 *       no material to cite — the persona must draw on its own knowledge
 *       and lived experience to discuss the SUBJECT of the question.
 *   (b) A longer submission with substantive content (paragraphs describing
 *       a policy, proposal, creative work, etc.) that personas should
 *       critique with verbatim quotes from the submission.
 *
 * The original single-prompt path forced every Topic flow through the
 * "submission critique" pattern, which made personas score the wording of
 * a 6-word question. This helper flags case (a) so the parse, classify,
 * and persona-review stages can switch to a "respond to the subject"
 * variant that skips verbatim-quote requirements.
 */
export function isShortTopicQuery(mode: "product" | "topic" | undefined, rawInput: string): boolean {
  if (mode !== "topic") return false;
  const trimmed = (rawInput ?? "").trim();
  if (trimmed.length === 0) return true;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  return wordCount < 25 && trimmed.length < 200;
}
