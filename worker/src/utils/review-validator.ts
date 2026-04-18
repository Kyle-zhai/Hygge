const BANNED_PHRASES = [
  "has potential",
  "could be better",
  "interesting idea",
  "well thought out",
  "needs more work",
  "solid foundation",
  "great start",
  "overall good",
  "generally positive",
  "compelling vision",
  "thoughtful approach",
  "has merit",
  "a decent chance",
  "reasonable idea",
  "promising direction",
];

const TRIVIAL_CONNECTORS = new Set([
  "and", "or", "the", "an", "a", "is", "in", "of", "to", "for", "with", "but", "as", "at", "on", "by", "from",
]);

function maskContractions(s: string): string {
  return s.replace(/([A-Za-z])'(?=[A-Za-z])/g, "$1\u0001");
}

function normalizeQuote(q: string): string {
  return q
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:!?"'()[\]{}—–-]+|[\s.,;:!?"'()[\]{}—–-]+$/g, "")
    .trim();
}

function isConnectorOnly(s: string): boolean {
  const words = s.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((w) => TRIVIAL_CONNECTORS.has(w));
}

function isIdentifier(s: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(s.trim());
}

export interface ReviewValidation {
  bannedHits: string[];
  fabricatedQuotes: string[];
  invalidExtractedQuotes: string[];
  extractedQuotes: string[];
  unusedExtractedQuotes: string[];
  extractedCount: number;
  verbatimReviewCount: number;
}

export function validatePersonaReview(parsed: any, rawInput: string): ReviewValidation {
  const review: string = parsed?.review_text ?? "";
  const reviewLower = review.toLowerCase();
  const rtMasked = maskContractions(review);
  const rawMasked = maskContractions(rawInput).toLowerCase();
  const rawNorm = rawMasked.replace(/\s+/g, " ");

  const bannedHits = BANNED_PHRASES.filter((p) => reviewLower.includes(p));

  const extractedQuotesRaw: unknown[] = Array.isArray(parsed?.extracted_quotes) ? parsed.extracted_quotes : [];
  const invalidExtractedQuotes: string[] = extractedQuotesRaw
    .filter((q) => {
      if (typeof q !== "string") return true;
      const qN = normalizeQuote(maskContractions(q));
      return qN.length < 3 || !rawNorm.includes(qN);
    })
    .map((q) => (typeof q === "string" ? q : String(q)));

  const validExtractedStrings: string[] = extractedQuotesRaw.filter((q): q is string => {
    if (typeof q !== "string") return false;
    const qN = normalizeQuote(maskContractions(q));
    return qN.length >= 3 && rawNorm.includes(qN);
  });

  const doubles = [...rtMasked.matchAll(/"([^"\n]{3,120})"/g)].map((m) => m[1]);
  const singles = [...rtMasked.matchAll(/(?<![A-Za-z])'([^'\n]{3,120})'(?![A-Za-z])/g)].map((m) => m[1]);
  const allQuoted = [...doubles, ...singles].filter((q) => !isConnectorOnly(q) && !isIdentifier(q));

  const fabricatedQuotes = allQuoted.filter((q) => {
    const qN = normalizeQuote(q);
    return qN.length >= 3 && !rawNorm.includes(qN);
  });

  const verbatimReviewQuotes = allQuoted.filter((q) => {
    const qN = normalizeQuote(q);
    return qN.length >= 3 && rawNorm.includes(qN);
  });

  const reviewQuotesNorm = verbatimReviewQuotes.map((q) => normalizeQuote(q));
  const unusedExtractedQuotes = validExtractedStrings.filter((eq) => {
    const eqN = normalizeQuote(maskContractions(eq));
    if (eqN.length === 0) return false;
    return !reviewQuotesNorm.some((rqN) => rqN.includes(eqN) || eqN.includes(rqN));
  });

  return {
    bannedHits,
    fabricatedQuotes,
    invalidExtractedQuotes,
    extractedQuotes: validExtractedStrings,
    unusedExtractedQuotes,
    extractedCount: extractedQuotesRaw.length,
    verbatimReviewCount: verbatimReviewQuotes.length,
  };
}

export function hasReviewViolations(v: ReviewValidation): boolean {
  return (
    v.bannedHits.length > 0 ||
    v.fabricatedQuotes.length > 0 ||
    v.invalidExtractedQuotes.length > 0 ||
    v.extractedCount < 3 ||
    v.verbatimReviewCount < 3
  );
}

export function buildReviewRetryInstructions(v: ReviewValidation): string {
  const items: string[] = [];
  if (v.invalidExtractedQuotes.length) {
    const list = v.invalidExtractedQuotes.slice(0, 5).map((q) => `"${String(q).slice(0, 80)}"`).join(", ");
    items.push(`- These extracted_quotes entries do NOT appear verbatim in the submission — replace them with fragments that exist character-for-character: ${list}.`);
  }
  if (v.extractedCount < 3) {
    items.push(`- extracted_quotes must contain at least 3 distinct fragments, each copied verbatim from the submission (3–60 chars each).`);
  }
  if (v.fabricatedQuotes.length) {
    const list = v.fabricatedQuotes.slice(0, 5).map((q) => `"${q.slice(0, 80)}"`).join(", ");
    items.push(`- review_text contains these quoted phrases that are NOT verbatim in the submission — remove the quote marks or replace with a true verbatim fragment: ${list}.`);
  }
  if (v.verbatimReviewCount < 3) {
    const needed = Math.max(1, 3 - v.verbatimReviewCount);
    const hint = v.unusedExtractedQuotes.length > 0
      ? ` Use these unused entries from your extracted_quotes: ${v.unusedExtractedQuotes.slice(0, 5).map((q) => `"${String(q).slice(0, 80)}"`).join(", ")}.`
      : ` Pull additional verbatim fragments directly from the submission.`;
    items.push(`- review_text currently contains only ${v.verbatimReviewCount} verbatim double-quoted fragment(s); you need at least 3. Rewrite at least ${needed} sentence(s) in review_text to embed additional verbatim fragments from the submission inside double quotes.${hint}`);
  }
  if (v.bannedHits.length) {
    const list = v.bannedHits.map((p) => `"${p}"`).join(", ");
    items.push(`- Delete these banned phrases from review_text and rewrite the surrounding sentence around a specific number, quote, or lived-experience observation: ${list}.`);
  }
  return items.join("\n");
}

export interface DimensionCheck {
  key: string;
  reason: string;
}

export function findGenericDimensions(
  dimensions: Array<{ key: string; description?: string }>,
  rawInput: string
): DimensionCheck[] {
  const rawTokens = new Set(
    rawInput.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 4)
  );
  const out: DimensionCheck[] = [];
  for (const d of dimensions) {
    const desc = d.description ?? "";
    const hasNumber = /[\d$%]/.test(desc);
    const descTokens = desc.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 4);
    const overlap = descTokens.filter((w) => rawTokens.has(w)).length;
    if (!hasNumber && overlap < 2) {
      out.push({ key: d.key, reason: "description lacks specific number or proper-noun overlap with submission" });
    }
  }
  return out;
}
