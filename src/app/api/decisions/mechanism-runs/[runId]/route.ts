// GET /api/decisions/mechanism-runs/[runId]
// Full mechanism transcript for the "view details" drilldown — the
// raw_output JSON is what `<MechanismRunDrawer />` renders.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 10;

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("decision_mechanism_runs")
    .select(`
      id, brief_id, kind, status, args, raw_output, error_message,
      attempts, started_at, completed_at, duration_ms,
      decision_briefs!inner(
        decision_sessions!inner(user_id)
      )
    `)
    .eq("id", runId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const brief = data.decision_briefs as unknown as {
    decision_sessions: { user_id: string };
  } | null;
  if (brief && brief.decision_sessions.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { decision_briefs: _omit, ...run } = data as Record<string, unknown>;
  void _omit;
  return NextResponse.json({ run });
}
