// GET /api/decisions/briefs/[briefId]/findings
// All findings for a brief, grouped by source_mechanism.
// Used by ArtifactView to render the per-mechanism sections.

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

  // RLS gates by ownership through decision_sessions; just listing here.
  const { data: findings, error } = await supabase
    .from("decision_findings")
    .select("*")
    .eq("brief_id", briefId)
    .order("source_mechanism", { ascending: true })
    .order("position", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("decisions.findings.get_failed", { briefId, message: error.message });
    return NextResponse.json({ error: "Failed to load findings" }, { status: 500 });
  }

  // Mechanism runs piggyback so the UI can show status (running/completed/failed)
  // for each section even before findings arrive.
  const { data: runs } = await supabase
    .from("decision_mechanism_runs")
    .select("id, kind, status, error_message, duration_ms")
    .eq("brief_id", briefId);

  return NextResponse.json({ findings, mechanism_runs: runs ?? [] });
}
