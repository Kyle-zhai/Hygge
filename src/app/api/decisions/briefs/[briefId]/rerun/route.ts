// POST /api/decisions/briefs/[briefId]/rerun
// Creates a child Brief in the same session, inheriting the parent's
// routing extract with an optional delta applied. Posts a system message
// to the chat ("re-running with [delta]...") and an agent_confirmation so
// the user can adjust before the orchestrator fires.
//
// Body: {
//   delta?: {
//     remove_dimensions?: Dimension[],
//     drop_mechanisms?: MechanismKind[],
//     swap_personas?: boolean,
//     note?: string,           // free-text describing the change
//   }
// }

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enqueueDecisionIntake } from "@/lib/queue/decision";

export const maxDuration = 15;

const VALID_MECHANISM_KINDS = new Set([
  "persona_review",
  "round_table_debate",
  "reflection_ranker",
  "scenario_simulation",
  "theory_of_mind",
  "cross_challenge",
]);

const VALID_DIMENSIONS = new Set([
  "technical", "business", "ux", "strategic", "people", "finance",
]);

const MAX_DELTA_NOTE_LEN = 2000;

interface DeltaBody {
  delta?: {
    remove_dimensions?: string[];
    drop_mechanisms?: string[];
    swap_personas?: boolean;
    note?: string;
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ briefId: string }> },
) {
  const { briefId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: /rerun spawns a full orchestrator run (6 LLM calls minimum).
  // Cap at 10/h per user; deep-chain depth is enforced separately by the
  // 065 trigger in the DB layer.
  const limitResponse = await enforceRateLimit("decisionRerun", user.id);
  if (limitResponse) return limitResponse;

  let body: DeltaBody = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — rerun without changes
  }
  const delta = body.delta ?? {};

  // Validate delta against known enums + length caps. Anything outside
  // the allowlists is silently dropped; this keeps a malicious client
  // from inserting arbitrary strings into mechanism_kinds or
  // primary_dimensions and corrupting routing.
  const safeDelta: DeltaBody["delta"] = {
    remove_dimensions: (delta.remove_dimensions ?? []).filter((d): d is string =>
      typeof d === "string" && VALID_DIMENSIONS.has(d),
    ),
    drop_mechanisms: (delta.drop_mechanisms ?? []).filter((m): m is string =>
      typeof m === "string" && VALID_MECHANISM_KINDS.has(m),
    ),
    swap_personas: Boolean(delta.swap_personas),
    note:
      typeof delta.note === "string"
        ? delta.note.slice(0, MAX_DELTA_NOTE_LEN)
        : undefined,
  };

  const { data: parent, error: parentErr } = await supabase
    .from("decision_briefs")
    .select(`
      id, session_id, canonical_question, routing_extract,
      persona_ids, mechanisms, raw_user_messages,
      decision_sessions!inner(user_id)
    `)
    .eq("id", briefId)
    .maybeSingle();

  if (parentErr) return NextResponse.json({ error: parentErr.message }, { status: 500 });
  if (!parent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sess = parent.decision_sessions as unknown as { user_id: string };
  if (sess.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Apply delta to inherited routing.
  const inheritedExtract = parent.routing_extract as Record<string, unknown>;
  const inheritedMechanisms = (parent.mechanisms as Array<{ kind: string }>) ?? [];

  const newDimensions = applyDimensionRemoval(
    inheritedExtract,
    safeDelta?.remove_dimensions ?? [],
  );
  const newMechanisms = inheritedMechanisms.filter(
    (m) => !(safeDelta?.drop_mechanisms ?? []).includes(m.kind),
  );

  // Insert a child Brief in draft status. Intake processor will turn it
  // into agent_confirmation when it runs.
  const newExtract = newDimensions
    ? { ...inheritedExtract, primary_dimensions: newDimensions }
    : inheritedExtract;

  const { data: child, error: insertErr } = await supabase
    .from("decision_briefs")
    .insert({
      session_id: parent.session_id,
      parent_brief_id: parent.id,
      canonical_question: parent.canonical_question,
      routing_extract: newExtract,
      raw_user_messages: parent.raw_user_messages,
      persona_ids: safeDelta?.swap_personas ? [] : parent.persona_ids,
      mechanisms: newMechanisms,
      mechanism_kinds: newMechanisms.map((m) => m.kind),
      decision_type:
        (newExtract as { decision_type?: { value?: string } }).decision_type?.value ?? null,
      primary_dimensions:
        (newExtract as { primary_dimensions?: { value?: string[] } }).primary_dimensions?.value ?? [],
    })
    .select("id")
    .single();

  if (insertErr) {
    // Surface trigger errors verbatim (e.g. parent_brief_id chain depth
    // exceeded from migration 065) but log to server. Generic message for
    // anything else so we don't leak Postgres internals.
    if (/chain exceeds max depth/i.test(insertErr.message)) {
      return NextResponse.json({ error: insertErr.message }, { status: 422 });
    }
    console.error("decisions.rerun.insert_failed", { briefId, message: insertErr.message });
    return NextResponse.json({ error: "Failed to create rerun" }, { status: 500 });
  }

  // Post a system note describing the rerun, then a user_text recording the
  // user's stated change so intake can re-run extraction over the cumulative
  // context. The system note is informational; the user_text is what
  // triggers the intake's question/confirmation logic.
  await supabase.from("decision_messages").insert({
    session_id: parent.session_id,
    kind: "system",
    content: buildSystemNote(safeDelta),
    brief_id: child.id,
    is_ephemeral: false,
  });

  if (safeDelta?.note && safeDelta.note.trim()) {
    await supabase.from("decision_messages").insert({
      session_id: parent.session_id,
      kind: "user_text",
      content: safeDelta.note.trim(),
      brief_id: child.id,
      is_ephemeral: false,
    });
  }

  await supabase
    .from("decision_sessions")
    .update({ last_msg_at: new Date().toISOString() })
    .eq("id", parent.session_id);

  await enqueueDecisionIntake({ sessionId: parent.session_id });

  return NextResponse.json({ brief_id: child.id }, { status: 201 });
}

function applyDimensionRemoval(
  extract: Record<string, unknown>,
  remove: string[],
): { value: string[]; confidence: number; source_quote: string | null; was_asked: boolean } | null {
  if (remove.length === 0) return null;
  const dims = extract.primary_dimensions as
    | { value?: string[]; confidence?: number; source_quote?: string | null; was_asked?: boolean }
    | undefined;
  if (!dims?.value) return null;
  const filtered = dims.value.filter((d) => !remove.includes(d));
  return {
    value: filtered,
    confidence: dims.confidence ?? 0,
    source_quote: dims.source_quote ?? null,
    was_asked: dims.was_asked ?? false,
  };
}

function buildSystemNote(delta: DeltaBody["delta"]): string {
  if (!delta) return "Re-running analysis.";
  const parts: string[] = [];
  if (delta.remove_dimensions?.length) {
    parts.push(`Removed dimensions: ${delta.remove_dimensions.join(", ")}`);
  }
  if (delta.drop_mechanisms?.length) {
    parts.push(`Dropped mechanisms: ${delta.drop_mechanisms.join(", ")}`);
  }
  if (delta.swap_personas) parts.push("Swapping personas.");
  if (parts.length === 0) return "Re-running with new conditions.";
  return parts.join(" • ");
}
