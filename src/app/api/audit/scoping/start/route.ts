import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchUserLLMOverrides } from "@/lib/llm/user-overrides";
import { enqueueAuditScoping } from "@/lib/queue/audit-scoping";
import { appendAuditTrail } from "@/lib/audit/hash-chain";

export const maxDuration = 15;

const VALID_LANGS = new Set(["en", "zh"]);

interface StartBody {
  audit_session_id?: string;
  reply_language?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: StartBody;
  try {
    body = (await request.json()) as StartBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const auditSessionId = body.audit_session_id?.trim();
  if (!auditSessionId) {
    return NextResponse.json({ error: "audit_session_id required" }, { status: 400 });
  }
  const replyLanguage: "en" | "zh" =
    body.reply_language && VALID_LANGS.has(body.reply_language)
      ? (body.reply_language as "en" | "zh")
      : "en";

  const { data: session, error: sessionErr } = await supabase
    .from("audit_sessions")
    .select("id, user_id, decision_text")
    .eq("id", auditSessionId)
    .maybeSingle();
  if (sessionErr || !session) {
    return NextResponse.json({ error: "Audit session not found" }, { status: 404 });
  }
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!session.decision_text || session.decision_text.trim().length < 20) {
    return NextResponse.json({ error: "decision_text is empty or too short" }, { status: 400 });
  }

  // 1:1 with audit_session_id (unique index in migration 051). If a row already
  // exists, return it instead of failing — the user just hit Start again.
  const { data: existing } = await supabase
    .from("audit_scoping_sessions")
    .select("id, status")
    .eq("audit_session_id", auditSessionId)
    .maybeSingle();

  let scopingId: string;
  if (existing) {
    scopingId = existing.id as string;
  } else {
    const { data: created, error: insertErr } = await supabase
      .from("audit_scoping_sessions")
      .insert({ audit_session_id: auditSessionId, status: "created" })
      .select("id")
      .single();
    if (insertErr || !created) {
      return NextResponse.json(
        { error: insertErr?.message ?? "Failed to create scoping session" },
        { status: 500 },
      );
    }
    scopingId = created.id as string;

    try {
      await appendAuditTrail(createAdminClient(), {
        sessionId: auditSessionId,
        action: "scoping_started",
        actorId: user.id,
        payload: { scoping_id: scopingId, reply_language: replyLanguage },
      });
    } catch (trailErr) {
      console.error("audit_trail append failed on scoping_started:", trailErr);
    }
  }

  const llmOverrides = await fetchUserLLMOverrides(user.id);

  try {
    await enqueueAuditScoping({
      scopingId,
      llmOverrides: llmOverrides ?? undefined,
      replyLanguage,
    });
  } catch (queueErr) {
    console.error("Failed to enqueue audit-scoping:", queueErr);
    return NextResponse.json(
      { error: "Scoping service temporarily unavailable. Please retry." },
      { status: 503 },
    );
  }

  return NextResponse.json({ id: scopingId, audit_session_id: auditSessionId }, { status: 201 });
}
