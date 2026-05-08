// GET /api/decisions/briefs/[briefId]
// Brief header for the artifact view: routing context, persona ids,
// mechanism kinds, status, timing.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 10;

export async function GET(
  _request: Request,
  context: { params: Promise<{ briefId: string }> },
) {
  const { briefId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("decision_briefs")
    .select(`
      id, session_id, parent_brief_id, status, sealed_by, decision_type,
      primary_dimensions, canonical_question, persona_ids, mechanism_kinds,
      mechanisms, routing_extract, question_log, raw_user_messages,
      total_intake_tokens, extraction_confidence_avg, version,
      created_at, finalized_at,
      decision_sessions!inner(user_id)
    `)
    .eq("id", briefId)
    .maybeSingle();

  if (error) {
    console.error("decisions.brief.get_failed", { briefId, message: error.message });
    return NextResponse.json({ error: "Failed to load brief" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // RLS already gates by session ownership; this is defense-in-depth.
  const sess = data.decision_sessions as unknown as { user_id: string } | null;
  if (sess && sess.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Strip the join helper before returning.
  const { decision_sessions: _omit, ...brief } = data as Record<string, unknown>;
  void _omit;
  return NextResponse.json({ brief });
}
