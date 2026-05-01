import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchEffectivePlan } from "@/lib/billing/effective-plan";
import { fetchUserLLMOverrides } from "@/lib/llm/user-overrides";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enqueueAudit } from "@/lib/queue/audit";
import { appendAuditTrail, sha256Hex } from "@/lib/audit/hash-chain";

export const maxDuration = 15;

// Audit decisions can include the user's narrative + the parsed text from one
// or more uploaded source documents (memo, slides, spreadsheet). We cap at
// 1MB to keep the row small enough for Postgres + the function payload limit
// while still allowing several long source docs to ride along.
const MAX_DECISION_BYTES = 1024 * 1024;
const MAX_PENDING_FILES = 8;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitResponse = await enforceRateLimit("evaluations", user.id);
  if (limitResponse) return limitResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    decision_text,
    template_slug,
    decision_meta,
    pending_file_ids,
  } = (body ?? {}) as {
    decision_text?: string;
    template_slug?: string;
    decision_meta?: Record<string, unknown>;
    pending_file_ids?: string[];
  };

  const pendingFileIds = Array.isArray(pending_file_ids)
    ? pending_file_ids.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
  if (pendingFileIds.length > MAX_PENDING_FILES) {
    return NextResponse.json(
      { error: `Too many files; max ${MAX_PENDING_FILES} per audit` },
      { status: 400 },
    );
  }

  if (!decision_text || decision_text.trim().length < 20) {
    return NextResponse.json({ error: "decision_text too short" }, { status: 400 });
  }
  if (!template_slug) {
    return NextResponse.json({ error: "template_slug required" }, { status: 400 });
  }

  const decisionBytes = Buffer.byteLength(decision_text, "utf8");
  if (decisionBytes > MAX_DECISION_BYTES) {
    return NextResponse.json(
      { error: `decision_text exceeds ${MAX_DECISION_BYTES} bytes (${decisionBytes} received)` },
      { status: 413 }
    );
  }

  const { data: template, error: templateErr } = await supabase
    .from("audit_templates")
    .select("slug, is_active")
    .eq("slug", template_slug)
    .maybeSingle();
  if (templateErr || !template || !template.is_active) {
    return NextResponse.json({ error: "Unknown audit template" }, { status: 400 });
  }

  const effective = await fetchEffectivePlan(supabase, user.id);
  if (!effective) {
    return NextResponse.json({ error: "No subscription found" }, { status: 403 });
  }

  if (!effective.skipQuota && effective.evaluationsUsed >= effective.evaluationsLimit) {
    return NextResponse.json({ error: "Monthly audit limit reached" }, { status: 429 });
  }

  const decisionHash = sha256Hex(decision_text);

  const { data: session, error: sessionErr } = await supabase
    .from("audit_sessions")
    .insert({
      user_id: user.id,
      template_slug,
      decision_text,
      decision_text_sha256: decisionHash,
      decision_meta: decision_meta ?? {},
      status: "pending",
    })
    .select()
    .single();

  if (sessionErr || !session) {
    return NextResponse.json(
      { error: sessionErr?.message ?? "Failed to create audit session" },
      { status: 500 }
    );
  }

  if (!effective.skipQuota) {
    await supabase
      .from("subscriptions")
      .update({ evaluations_used: effective.evaluationsUsed + 1 })
      .eq("user_id", user.id);
  }

  // Attach any pending uploads created earlier by /api/audit/parse-file. We
  // verify ownership and that the rows aren't already attached to a different
  // session before claiming them. The select-then-update pattern surfaces
  // stale or hijacked IDs as a clear error rather than silently dropping
  // attachment context.
  if (pendingFileIds.length > 0) {
    const admin = createAdminClient();
    const { data: pendingRows, error: pendingErr } = await admin
      .from("audit_session_files")
      .select("id, user_id, session_id")
      .in("id", pendingFileIds);
    if (pendingErr) {
      console.error("audit/sessions pending-files lookup failed", {
        error: pendingErr.message,
      });
    }
    const validIds: string[] = [];
    for (const row of pendingRows ?? []) {
      if (row.user_id !== user.id) continue;
      if (row.session_id && row.session_id !== session.id) continue;
      validIds.push(row.id as string);
    }
    if (validIds.length > 0) {
      await admin
        .from("audit_session_files")
        .update({ session_id: session.id, attached_at: new Date().toISOString() })
        .in("id", validIds);
    }
  }

  try {
    await appendAuditTrail(createAdminClient(), {
      sessionId: session.id,
      action: "session_created",
      actorId: user.id,
      payload: {
        template_slug,
        decision_text_sha256: decisionHash,
        decision_meta: decision_meta ?? {},
      },
    });
  } catch (trailErr) {
    console.error("Failed to write opening audit_trail row, rolling back session:", trailErr);
    await supabase.from("audit_sessions").update({ status: "failed" }).eq("id", session.id);
    if (!effective.skipQuota) {
      await supabase
        .from("subscriptions")
        .update({ evaluations_used: effective.evaluationsUsed })
        .eq("user_id", user.id);
    }
    return NextResponse.json(
      { error: "Failed to initialize audit trail. Please retry." },
      { status: 500 }
    );
  }

  const llmOverrides = await fetchUserLLMOverrides(user.id);

  try {
    await enqueueAudit({
      auditSessionId: session.id,
      templateSlug: template_slug,
      decisionText: decision_text,
      decisionMeta: decision_meta ?? {},
      userId: user.id,
      workspaceId: session.workspace_id ?? null,
      llmOverrides: llmOverrides ?? undefined,
    });
  } catch (queueErr) {
    console.error("Failed to enqueue audit, rolling back:", queueErr);
    await supabase.from("audit_sessions").update({ status: "failed" }).eq("id", session.id);
    if (!effective.skipQuota) {
      await supabase
        .from("subscriptions")
        .update({ evaluations_used: effective.evaluationsUsed })
        .eq("user_id", user.id);
    }
    return NextResponse.json(
      { error: "Audit service temporarily unavailable. Please retry." },
      { status: 503 }
    );
  }

  await supabase.from("audit_sessions").update({ status: "running" }).eq("id", session.id);

  return NextResponse.json({ id: session.id }, { status: 201 });
}
