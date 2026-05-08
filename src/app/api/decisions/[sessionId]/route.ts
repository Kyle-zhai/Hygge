// GET /api/decisions/[sessionId]
// Loads the session header. Messages and findings come from separate
// endpoints so the page can stream them independently via Realtime.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 10;

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("decision_sessions")
    .select("id, title, last_msg_at, created_at, workspace_id, user_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("decisions.session.get_failed", { sessionId, message: error.message });
    return NextResponse.json({ error: "Failed to load session" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (data.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ session: data });
}
