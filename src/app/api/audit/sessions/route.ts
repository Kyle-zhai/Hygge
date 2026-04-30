import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchEffectivePlan } from "@/lib/billing/effective-plan";
import { fetchUserLLMOverrides } from "@/lib/llm/user-overrides";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enqueueAudit } from "@/lib/queue/audit";
import { appendAuditTrail, sha256Hex } from "@/lib/audit/hash-chain";

export const maxDuration = 15;

const MAX_DECISION_BYTES = 64 * 1024;

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

  const { decision_text, template_slug, decision_meta } = (body ?? {}) as {
    decision_text?: string;
    template_slug?: string;
    decision_meta?: Record<string, unknown>;
  };

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
