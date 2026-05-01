// /api/audit/sessions/[id]/run — POST
//
// Triggers Layers 2–5 of the multi-agent audit kernel.
// Pre-conditions enforced server-side:
//   - caller is the audit_session.user_id (or a workspace member)
//   - audit_scoping_sessions.status = 'scope_locked'
//   - audit_session.status not already terminal (findings_ready / signed_off / archived)
//
// Side effects:
//   - audit_session.status -> 'running' (the worker re-asserts this; doing it
//     here too gives the UI immediate feedback and prevents double-enqueues).
//   - audit_trail entry: 'pipeline_enqueued'
//   - BullMQ 'audit-pipeline' job pushed
//
// Idempotent on retry: if status is already 'running' we just re-enqueue.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchUserLLMOverrides } from "@/lib/llm/user-overrides";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enqueueAuditPipeline } from "@/lib/queue/audit-pipeline";
import { appendAuditTrail } from "@/lib/audit/hash-chain";

export const maxDuration = 15;

const VALID_LANGS = new Set(["en", "zh"]);

// Mirror of the cron sweeper threshold (sweep-stuck-audits/route.ts). If a
// session has been 'running' for longer than this, the worker is presumed
// dead and the user is allowed to re-enqueue without waiting for the cron.
const STALE_RUNNING_THRESHOLD_MS = 15 * 60 * 1000;

function isStaleRunning(pipelineStartedAt: string | null): boolean {
  if (!pipelineStartedAt) return true; // legacy rows pre-migration 055
  const startedMs = Date.parse(pipelineStartedAt);
  if (Number.isNaN(startedMs)) return true;
  return Date.now() - startedMs > STALE_RUNNING_THRESHOLD_MS;
}

interface Ctx {
  params: Promise<{ id: string }>;
}

interface RunBody {
  reply_language?: string;
}

export async function POST(request: Request, ctx: Ctx) {
  const { id: sessionId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await enforceRateLimit("evaluations", user.id);
  if (limit) return limit;

  let body: RunBody = {};
  try {
    body = (await request.json().catch(() => ({}))) as RunBody;
  } catch {
    body = {};
  }
  const replyLanguage: "en" | "zh" =
    body.reply_language && VALID_LANGS.has(body.reply_language)
      ? (body.reply_language as "en" | "zh")
      : "en";

  // Ownership / status checks. RLS already filters select for non-owners but
  // we hit it explicitly so error messages are precise.
  const { data: session, error: sessionErr } = await supabase
    .from("audit_sessions")
    .select("id, user_id, workspace_id, status, pipeline_started_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionErr || !session) {
    return NextResponse.json(
      { error: "Audit session not found" },
      { status: 404 },
    );
  }
  if (
    session.status === "findings_ready" ||
    session.status === "signed_off" ||
    session.status === "archived"
  ) {
    return NextResponse.json(
      {
        error: `Audit already ${session.status}; create a new session to re-run.`,
      },
      { status: 409 },
    );
  }
  if (session.status === "running" && !isStaleRunning(session.pipeline_started_at)) {
    return NextResponse.json(
      { error: "Pipeline already in progress for this audit." },
      { status: 409 },
    );
  }

  const { data: scoping, error: scopingErr } = await supabase
    .from("audit_scoping_sessions")
    .select("id, status, scope_in")
    .eq("audit_session_id", sessionId)
    .maybeSingle();
  if (scopingErr || !scoping) {
    return NextResponse.json(
      { error: "No scoping session for this audit. Run /scoping/start first." },
      { status: 409 },
    );
  }
  if (scoping.status !== "scope_locked") {
    return NextResponse.json(
      {
        error: `Scope not yet locked (status=${scoping.status}). Finalize scoping before running.`,
      },
      { status: 409 },
    );
  }
  const scopeInLen = Array.isArray(scoping.scope_in) ? scoping.scope_in.length : 0;
  if (scopeInLen === 0) {
    return NextResponse.json(
      {
        error: "scope_in is empty — there's nothing to audit. Re-scope and retry.",
      },
      { status: 409 },
    );
  }

  const llmOverrides = await fetchUserLLMOverrides(user.id);

  try {
    await enqueueAuditPipeline({
      sessionId,
      llmOverrides: llmOverrides ?? undefined,
      auxLlmOverrides: llmOverrides ?? undefined,
      replyLanguage,
    });
  } catch (queueErr) {
    console.error("Failed to enqueue audit-pipeline:", queueErr);
    return NextResponse.json(
      { error: "Audit service temporarily unavailable. Please retry." },
      { status: 503 },
    );
  }

  // Best-effort: flip to 'running' so the UI hides the "Run audit" button.
  // The worker will re-write this; if the update fails the worker still wins.
  await supabase
    .from("audit_sessions")
    .update({ status: "running" })
    .eq("id", sessionId)
    .neq("status", "signed_off");

  try {
    await appendAuditTrail(createAdminClient(), {
      sessionId,
      action: "pipeline_enqueued",
      actorId: user.id,
      payload: {
        reply_language: replyLanguage,
        scope_in_count: scopeInLen,
      },
    });
  } catch (trailErr) {
    console.error("audit_trail append failed on pipeline_enqueued:", trailErr);
  }

  return NextResponse.json({ ok: true, sessionId, status: "running" }, {
    status: 202,
  });
}
