import { supabase } from "../supabase.js";
import { log } from "../utils/logger.js";

export interface ProceduralExample {
  persona_id: string;
  utterance_excerpt: string | null;
  user_comment: string | null;
  created_at: string;
}

export interface ProceduralMemoryByPersona {
  byPersonaId: Map<string, ProceduralExample[]>;
}

const MAX_PER_PERSONA = 3;
const FETCH_LIMIT = 24;
const EXCERPT_CHARS = 220;

interface FeedbackRow {
  persona_id: string;
  comment: string | null;
  created_at: string;
  debate_message_id: string | null;
  debate_messages: { content: string | null } | { content: string | null }[] | null;
}

export async function loadProceduralMemoryByPersona(
  personaIds: string[],
): Promise<ProceduralMemoryByPersona> {
  const result: ProceduralMemoryByPersona = { byPersonaId: new Map() };
  if (personaIds.length === 0) return result;

  const { data, error } = await supabase
    .from("persona_utterance_feedback")
    .select("persona_id, comment, created_at, debate_message_id, debate_messages(content)")
    .in("persona_id", personaIds)
    .eq("rating", 1)
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT * personaIds.length);

  if (error) {
    log.warn("procedural_memory.load_failed", { error: error.message });
    return result;
  }

  for (const row of (data ?? []) as FeedbackRow[]) {
    const list = result.byPersonaId.get(row.persona_id) ?? [];
    if (list.length >= MAX_PER_PERSONA) continue;

    const dm = row.debate_messages;
    const content = Array.isArray(dm) ? dm[0]?.content : dm?.content;
    const excerpt = content ? content.slice(0, EXCERPT_CHARS) : null;
    const comment = row.comment?.trim() || null;

    if (!excerpt && !comment) continue;

    list.push({
      persona_id: row.persona_id,
      utterance_excerpt: excerpt,
      user_comment: comment,
      created_at: row.created_at,
    });
    result.byPersonaId.set(row.persona_id, list);
  }

  return result;
}

export function formatProceduralExamples(examples: ProceduralExample[]): string {
  if (examples.length === 0) return "";
  const lines = examples.map((ex, idx) => {
    if (ex.utterance_excerpt && ex.user_comment) {
      return `(${idx + 1}) You said: "${ex.utterance_excerpt}" — A real user noted: "${ex.user_comment}"`;
    }
    if (ex.utterance_excerpt) {
      return `(${idx + 1}) You said: "${ex.utterance_excerpt}" — flagged as authentic by a real user`;
    }
    return `(${idx + 1}) Earlier feedback you earned: "${ex.user_comment}"`;
  });
  return [
    "Procedural memory — patterns of yours that earned positive feedback from real users in past debates:",
    ...lines,
    "Match the texture of these — concrete, specific, in-character. Do NOT quote them; channel the same register.",
  ].join("\n");
}
