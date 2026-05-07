// POST /api/decisions
// Creates a new decision_session and returns its id. The first user message
// is created in a follow-up POST to /api/decisions/[sessionId]/messages so
// the session row exists before message inserts (RLS uses session ownership).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 10;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { workspace_id?: string; title?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  const { data, error } = await supabase
    .from("decision_sessions")
    .insert({
      user_id: user.id,
      workspace_id: body.workspace_id ?? null,
      title: body.title ?? null,
    })
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session: data }, { status: 201 });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("decision_sessions")
    .select("id, title, last_msg_at, created_at")
    .eq("user_id", user.id)
    .order("last_msg_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions: data });
}
