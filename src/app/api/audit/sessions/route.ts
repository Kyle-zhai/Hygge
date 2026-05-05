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

  // Either a typed narrative OR at least one attached file must be provided.
  // The audit pipeline worker pulls extracted text from attached files at
  // run time and prepends it to decision_text.
  const decisionTextStr = (decision_text ?? "").trim();
  if (decisionTextStr.length < 20 && pendingFileIds.length === 0) {
    return NextResponse.json(
      { error: "decision_text or at least one uploaded file required" },
      { status: 400 },
    );
  }
  if (!template_slug) {
    return NextResponse.json({ error: "template_slug required" }, { status: 400 });
  }

  const decisionBytes = Buffer.byteLength(decisionTextStr, "utf8");
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

  // Fast-path 429 when quota is clearly exceeded — skips creating a session
  // row that would just be rolled back. The atomic increment below is the
  // authoritative gate; this check only avoids the round trip in the
  // common over-quota case.
  if (!effective.skipQuota && effective.evaluationsUsed >= effective.evaluationsLimit) {
    return NextResponse.json({ error: "Monthly audit limit reached" }, { status: 429 });
  }

  // Atomic check-and-increment: closes the TOCTOU window where two
  // concurrent POSTs both read evaluations_used < limit and both wrote
  // used+1, double-spending one quota slot. The RPC returns success=false
  // if quota is exhausted under row lock.
  if (!effective.skipQuota) {
    const { data: incrementRows, error: incrementErr } = await supabase.rpc(
      "increment_evaluations_used",
      { p_user_id: user.id },
    );
    if (incrementErr) {
      console.error("audit/sessions quota increment failed", { error: incrementErr.message });
      return NextResponse.json({ error: "Quota check failed. Please retry." }, { status: 500 });
    }
    const result = Array.isArray(incrementRows) ? incrementRows[0] : incrementRows;
    if (!result?.success) {
      return NextResponse.json({ error: "Monthly audit limit reached" }, { status: 429 });
    }
  }

  const decisionHash = sha256Hex(decisionTextStr);

  const { data: session, error: sessionErr } = await supabase
    .from("audit_sessions")
    .insert({
      user_id: user.id,
      template_slug,
      decision_text: decisionTextStr,
      decision_text_sha256: decisionHash,
      decision_meta: decision_meta ?? {},
      status: "pending",
    })
    .select()
    .single();

  if (sessionErr || !session) {
    // Refund the quota we incremented above — the user's request didn't
    // actually consume a session.
    if (!effective.skipQuota) {
      await supabase.rpc("decrement_evaluations_used", { p_user_id: user.id });
    }
    return NextResponse.json(
      { error: sessionErr?.message ?? "Failed to create audit session" },
      { status: 500 }
    );
  }

  // Attach any pending uploads the browser created in audit_session_files
  // before submitting (browser uploads directly to Storage, mirroring the
  // /evaluate flow). We verify ownership and that the rows aren't already
  // attached to a different session before claiming them.
  //
  // Atomic single-statement UPDATE: the WHERE clause filters by user_id and
  // session_id IS NULL in the same SQL as the SET, so there's no
  // select-then-update race window. RETURNING id lets us see how many rows
  // we actually claimed; mismatches against pendingFileIds are logged but
  // don't block session creation (the IDs were likely stale or hijacked).
  if (pendingFileIds.length > 0) {
    const admin = createAdminClient();
    const { data: attached, error: attachErr } = await admin
      .from("audit_session_files")
      .update({ session_id: session.id, attached_at: new Date().toISOString() })
      .in("id", pendingFileIds)
      .eq("user_id", user.id)
      .is("session_id", null)
      .select("id");
    if (attachErr) {
      console.error("audit/sessions pending-files attach failed", {
        error: attachErr.message,
      });
    } else if ((attached?.length ?? 0) < pendingFileIds.length) {
      console.warn("audit/sessions partial pending-files attach", {
        sessionId: session.id,
        requested: pendingFileIds.length,
        attached: attached?.length ?? 0,
      });
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
      // Atomic decrement (not "set back to fetched value") so we don't
      // clobber another concurrent increment from the same user.
      await supabase.rpc("decrement_evaluations_used", { p_user_id: user.id });
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
      decisionText: decisionTextStr,
      decisionMeta: decision_meta ?? {},
      userId: user.id,
      workspaceId: session.workspace_id ?? null,
      llmOverrides: llmOverrides ?? undefined,
    });
  } catch (queueErr) {
    console.error("Failed to enqueue audit, rolling back:", queueErr);
    await supabase.from("audit_sessions").update({ status: "failed" }).eq("id", session.id);
    if (!effective.skipQuota) {
      await supabase.rpc("decrement_evaluations_used", { p_user_id: user.id });
    }
    return NextResponse.json(
      { error: "Audit service temporarily unavailable. Please retry." },
      { status: 503 }
    );
  }

  await supabase.from("audit_sessions").update({ status: "running" }).eq("id", session.id);

  return NextResponse.json({ id: session.id }, { status: 201 });
}
