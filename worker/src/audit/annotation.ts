// annotation.ts
//
// Multi-agent audit kernel: Layer 1a — passage splitting + per-passage tagging.
// Spec: docs/superpowers/specs/2026-04-30-multi-agent-audit-architecture.md §4
//
// Public surface:
//   - splitIntoPassages(rawText): deterministic, no LLM
//   - annotatePassages(rawText, llm): runs Layer 1a end-to-end, returns
//     AnnotatedPassage[] suitable for storing in audit_scoping_sessions.passages.
//
// Layer 1a uses the aux (small/cheap) chain so it stays well under $0.01 even
// for long uploads. The annotator is constrained to the vocabulary defined in
// annotation-tags.ts; anything off-vocabulary is silently dropped.
//
// Failure policy:
//   - A failed annotation pass on a single passage does NOT abort the upload.
//     We mark that passage with annotations: [] and surface it in the log;
//     Layer 1b can still ask clarifying questions about it.

import type { LLMAdapter } from "../llm/adapter.js";
import { robustJsonParse } from "../utils/json-parse.js";
import { log } from "../utils/logger.js";
import { renderAnnotationVocabulary, sanitizeAnnotations } from "./annotation-tags.js";

export interface AnnotatedPassage {
  idx: number;
  text: string;
  annotations: string[];
}

// ============================================
// Tunables
// ============================================
const MIN_PASSAGE_CHARS = 80;   // merge anything shorter into its neighbour
const MAX_PASSAGE_CHARS = 1500; // split anything longer at sentence boundaries
const TARGET_PASSAGE_CHARS = 1000;
const MAX_PASSAGES = 200;       // hard cap on a single audit upload
const ANNOTATOR_MAX_TOKENS = 256;

// ============================================
// Passage splitting (deterministic, no LLM)
// ============================================
export function splitIntoPassages(rawText: string): string[] {
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return [];

  // Primary split: blank lines.
  const blocks = normalized.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  const expanded: string[] = [];
  for (const block of blocks) {
    if (block.length <= MAX_PASSAGE_CHARS) {
      expanded.push(block);
      continue;
    }
    // Block too long — split on sentence boundaries, greedy-pack toward TARGET.
    const sentences = block
      .split(/(?<=[.!?。！？])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    let buf = "";
    for (const sent of sentences) {
      if (buf.length === 0) {
        buf = sent;
        continue;
      }
      if (buf.length + sent.length + 1 <= TARGET_PASSAGE_CHARS) {
        buf = `${buf} ${sent}`;
      } else {
        expanded.push(buf);
        buf = sent;
      }
    }
    if (buf) expanded.push(buf);
  }

  // Merge anything tiny forward into its neighbour to avoid noise passages.
  const merged: string[] = [];
  for (const p of expanded) {
    if (merged.length > 0 && p.length < MIN_PASSAGE_CHARS) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${p}`;
    } else {
      merged.push(p);
    }
  }

  // Final cap. Truncate, log loss — uploading novels through here is misuse,
  // and 200 passages of ~1k chars is ~200k chars which already exceeds any
  // reasonable decision text.
  if (merged.length > MAX_PASSAGES) {
    log.info("annotation.passages_truncated", {
      original: merged.length,
      kept: MAX_PASSAGES,
    });
    return merged.slice(0, MAX_PASSAGES);
  }
  return merged;
}

// ============================================
// Per-passage annotation
// ============================================
function buildAnnotatorSystem(): string {
  return [
    "You are a legal and AI-governance annotator working as Layer 1a of a multi-agent audit system.",
    "Your only job: read ONE passage from a deployment description, decide which concepts from a fixed vocabulary apply, and emit a strict JSON list.",
    "",
    "## Hard rules",
    "1. Use ONLY tags from the vocabulary below. Never invent tags.",
    "2. A tag fires when the passage AFFIRMATIVELY describes the concept. It does NOT fire when the passage merely mentions it as something the system does not do.",
    '   Example: "we never collect biometric data" → do NOT tag biometric.',
    "3. Be conservative. If you are unsure, leave the tag off. Layer 1b will ask the user a clarifying question.",
    "4. Do not invent risks the passage does not describe.",
    "5. Output JSON only, matching this schema exactly:",
    '   { "annotations": ["tag_id", ...] }',
    "",
    "## Vocabulary",
    renderAnnotationVocabulary(),
  ].join("\n");
}

function buildAnnotatorPrompt(passage: string): string {
  return [
    "## Passage",
    "```",
    passage,
    "```",
    "",
    'Return JSON only: { "annotations": ["tag_id", ...] }',
    "Empty list is valid if nothing applies.",
  ].join("\n");
}

interface RawAnnotatorOutput {
  annotations?: unknown;
}

async function annotateOnePassage(llm: LLMAdapter, passage: string): Promise<string[]> {
  const system = buildAnnotatorSystem();
  const prompt = buildAnnotatorPrompt(passage);
  const response = await llm.complete({
    system,
    prompt,
    maxTokens: ANNOTATOR_MAX_TOKENS,
    jsonMode: true,
  });
  const parsed = robustJsonParse<RawAnnotatorOutput>(response.text);
  return sanitizeAnnotations(parsed?.annotations);
}

export async function annotatePassages(
  rawText: string,
  llm: LLMAdapter,
): Promise<AnnotatedPassage[]> {
  const passages = splitIntoPassages(rawText);
  if (passages.length === 0) return [];

  const out: AnnotatedPassage[] = [];
  for (let idx = 0; idx < passages.length; idx++) {
    const text = passages[idx];
    let annotations: string[] = [];
    try {
      annotations = await annotateOnePassage(llm, text);
    } catch (err) {
      log.error("annotation.passage_failed", {
        passageIdx: idx,
        textPreview: text.slice(0, 120),
        error: err instanceof Error ? err.message : String(err),
      });
    }
    out.push({ idx, text, annotations });
  }
  return out;
}
