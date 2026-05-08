// GET  /api/decisions/[sessionId]/messages — full chat history
// POST /api/decisions/[sessionId]/messages — append a user message and
//                                              enqueue an intake job

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
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

  if (error) {
    console.error("decisions.messages.get_failed", { sessionId, message: error.message });
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }
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

  // Rate limit before any DB read — this is the LLM-trigger surface.
  // 60/min per user is generous for a human typing answers but blocks a
  // scripted client from draining the MiMo token budget.
  const limitResponse = await enforceRateLimit("decisionMessages", user.id);
  if (limitResponse) return limitResponse;

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

  // Validate user_option payloads against the most recent agent prompt's
  // option set. Without this check, a client could POST a synthetic
  // user_option with content like "drop_persona_review" and the intake
  // processor would dutifully drop a mechanism the agent never offered.
  if (body.kind === "user_option") {
    const { data: lastAgent } = await supabase
      .from("decision_messages")
      .select("kind, options")
      .eq("session_id", sessionId)
      .in("kind", ["agent_question", "agent_confirmation"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastAgent) {
      return NextResponse.json(
        { error: "no agent prompt is awaiting an answer" },
        { status: 409 },
      );
    }
    const opts = (lastAgent.options ?? []) as Array<{ id: string }>;
    if (!opts.some((o) => o.id === content)) {
      return NextResponse.json(
        { error: `option id "${content}" is not in the latest prompt` },
        { status: 400 },
      );
    }
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

  if (error) {
    console.error("decisions.messages.post_failed", { sessionId, kind: body.kind, message: error.message });
    return NextResponse.json({ error: "Failed to post message" }, { status: 500 });
  }

  await supabase
    .from("decision_sessions")
    .update({ last_msg_at: new Date().toISOString() })
    .eq("id", sessionId);

  // Fire intake job. Idempotent: jobId scoped to session collapses
  // concurrent requests; processor short-circuits if state is awaiting_user.
  await enqueueDecisionIntake({ sessionId });

  return NextResponse.json({ message: msg }, { status: 201 });
}
