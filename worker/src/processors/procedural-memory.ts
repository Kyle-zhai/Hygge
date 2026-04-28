import { supabase } from "../supabase.js";
import { log } from "../utils/logger.js";

export interface ProceduralExample {
  persona_id: string;
  utterance_excerpt: string | null;
  user_comment: string | null;
  created_at: string;
}

export interface ContrastiveProceduralMemory {
  positive: ProceduralExample[];
  negative: ProceduralExample[];
}

export interface ProceduralMemoryByPersona {
  byPersonaId: Map<string, ContrastiveProceduralMemory>;
}

const MAX_PER_PERSONA = 3;
const FETCH_LIMIT = 24;
const EXCERPT_CHARS = 220;

interface FeedbackRow {
  persona_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  debate_message_id: string | null;
  debate_messages: { content: string | null } | { content: string | null }[] | null;
}

function rowToExample(row: FeedbackRow): ProceduralExample | null {
  const dm = row.debate_messages;
  const content = Array.isArray(dm) ? dm[0]?.content : dm?.content;
  const excerpt = content ? content.slice(0, EXCERPT_CHARS) : null;
  const comment = row.comment?.trim() || null;
  if (!excerpt && !comment) return null;
  return {
    persona_id: row.persona_id,
    utterance_excerpt: excerpt,
    user_comment: comment,
    created_at: row.created_at,
  };
}

export async function loadProceduralMemoryByPersona(
  personaIds: string[],
): Promise<ProceduralMemoryByPersona> {
  const result: ProceduralMemoryByPersona = { byPersonaId: new Map() };
  if (personaIds.length === 0) return result;

  const { data, error } = await supabase
    .from("persona_utterance_feedback")
    .select("persona_id, rating, comment, created_at, debate_message_id, debate_messages(content)")
    .in("persona_id", personaIds)
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT * personaIds.length * 2);

  if (error) {
    log.warn("procedural_memory.load_failed", { error: error.message });
    return result;
  }

  for (const row of (data ?? []) as FeedbackRow[]) {
    const example = rowToExample(row);
    if (!example) continue;

    let bucket = result.byPersonaId.get(row.persona_id);
    if (!bucket) {
      bucket = { positive: [], negative: [] };
      result.byPersonaId.set(row.persona_id, bucket);
    }

    const target = row.rating === 1 ? bucket.positive : row.rating === -1 ? bucket.negative : null;
    if (!target) continue;
    if (target.length >= MAX_PER_PERSONA) continue;
    target.push(example);
  }

  return result;
}

function formatExampleLine(ex: ProceduralExample, idx: number, polarity: "good" | "bad"): string {
  if (ex.utterance_excerpt && ex.user_comment) {
    return `(${idx + 1}) "${ex.utterance_excerpt}" — user noted: "${ex.user_comment}"`;
  }
  if (ex.utterance_excerpt) {
    const marker = polarity === "good" ? "flagged as authentic" : "flagged as inauthentic / off-character";
    return `(${idx + 1}) "${ex.utterance_excerpt}" — ${marker}`;
  }
  const prefix = polarity === "good" ? "Positive feedback you earned" : "Negative feedback you earned";
  return `(${idx + 1}) ${prefix}: "${ex.user_comment}"`;
}

export function formatProceduralExamples(memory: ContrastiveProceduralMemory): string {
  const { positive, negative } = memory;
  if (positive.length === 0 && negative.length === 0) return "";

  const sections: string[] = [];

  if (positive.length > 0) {
    sections.push(
      "Procedural memory — sound LIKE this (real users marked these as authentic in your voice):",
      ...positive.map((ex, i) => formatExampleLine(ex, i, "good")),
    );
  }

  if (negative.length > 0) {
    sections.push(
      "",
      "Anti-patterns — do NOT sound like this (real users marked these as off-character or generic LLM-speak):",
      ...negative.map((ex, i) => formatExampleLine(ex, i, "bad")),
    );
  }

  sections.push("", "Channel the texture of the positives. Avoid the texture of the negatives. Do NOT quote either set.");

  return sections.join("\n");
}
