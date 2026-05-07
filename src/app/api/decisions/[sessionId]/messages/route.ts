// GET  /api/decisions/[sessionId]/messages — full chat history
// POST /api/decisions/[sessionId]/messages — append a user message and
//                                              enqueue an intake job

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enqueueDecisionIntake } from "@/lib/queue/decision";

export const maxDuration = 15;

const MAX_MESSAGE_BYTES = 16 * 1024;
const ALLOWED_USER_KINDS = ["user_text", "user_option", "user_skip_run"] as const;
type UserMessageKind = (typeof ALLOWED_USER_KINDS)[number];

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS gates by session ownership; the explicit user_id check is
  // defense-in-depth for service-key-equivalent scenarios.
  const { data: session } = await supabase
    .from("decision_sessions")
    .select("user_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("decision_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: session } = await supabase
    .from("decision_sessions")
    .select("user_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { kind: UserMessageKind; content: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!ALLOWED_USER_KINDS.includes(body.kind)) {
    return NextResponse.json(
      { error: `kind must be one of ${ALLOWED_USER_KINDS.join(", ")}` },
      { status: 400 },
    );
  }

  const content = body.kind === "user_skip_run" ? "" : (body.content ?? "");
  if (Buffer.byteLength(content, "utf8") > MAX_MESSAGE_BYTES) {
    return NextResponse.json(
      { error: `content exceeds ${MAX_MESSAGE_BYTES} bytes` },
      { status: 413 },
    );
  }

  const { data: msg, error } = await supabase
    .from("decision_messages")
    .insert({
      session_id: sessionId,
      kind: body.kind,
      content,
      is_ephemeral: false,
    })
    .select("id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("decision_sessions")
    .update({ last_msg_at: new Date().toISOString() })
    .eq("id", sessionId);

  // Fire intake job. Idempotent: jobId scoped to session collapses
  // concurrent requests; processor short-circuits if state is awaiting_user.
  await enqueueDecisionIntake({ sessionId });

  return NextResponse.json({ message: msg }, { status: 201 });
}
