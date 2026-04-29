// Deterministic two-class language detector for user-facing persona output.
//
// Classifies an arbitrary blob of text as "zh" (Chinese) or "en" (English /
// other Latin-script). Used to inject a REPLY_LANGUAGE directive into debate
// prompts so personas reply in one consistent language even when the user's
// input mixes scripts.
//
// Strategy: count CJK Unified Ideographs vs Latin letters; ignore punctuation,
// digits, and whitespace so they don't skew the ratio. CJK share ≥ 30%
// classifies as Chinese, anything else falls through to English. The 30%
// threshold is intentionally generous toward Chinese — a few CJK words
// embedded in an English block stay English, but a Chinese sentence with a
// few English brand names still classifies as Chinese.

export type ReplyLanguage = "zh" | "en";

const CJK_RE = /[\u3400-\u4DBF\u4E00-\u9FFF]/g;
const LATIN_RE = /[A-Za-z]/g;
const CJK_THRESHOLD = 0.3;

export function detectReplyLanguage(input: string | null | undefined): ReplyLanguage {
  if (!input) return "en";
  const cjkCount = (input.match(CJK_RE) ?? []).length;
  const latinCount = (input.match(LATIN_RE) ?? []).length;
  const total = cjkCount + latinCount;
  if (total === 0) return "en";
  return cjkCount / total >= CJK_THRESHOLD ? "zh" : "en";
}

// Weighted variant: later snippets count more — useful for chat history where
// the latest user turn is the strongest signal of intent. Weights are applied
// to CJK and Latin counts before ratio comparison.
export function detectReplyLanguageWeighted(
  snippets: Array<{ text: string | null | undefined; weight?: number }>,
): ReplyLanguage {
  let cjkScore = 0;
  let latinScore = 0;
  for (const { text, weight = 1 } of snippets) {
    if (!text) continue;
    cjkScore += (text.match(CJK_RE) ?? []).length * weight;
    latinScore += (text.match(LATIN_RE) ?? []).length * weight;
  }
  const total = cjkScore + latinScore;
  if (total === 0) return "en";
  return cjkScore / total >= CJK_THRESHOLD ? "zh" : "en";
}

// Human-readable directive line for prompt injection. Kept as a single
// sentence so it composes cleanly into existing system blocks.
export function replyLanguageDirective(lang: ReplyLanguage): string {
  return lang === "zh"
    ? "REPLY LANGUAGE: Chinese (zh). Write all user-facing text in Simplified Chinese. Keep proper nouns (brand names, persona names, product names) in their original script."
    : "REPLY LANGUAGE: English (en). Write all user-facing text in English. Keep proper nouns in their original script.";
}
