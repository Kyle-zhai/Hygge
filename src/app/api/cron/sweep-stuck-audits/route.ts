import { NextResponse } from "next/server";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 30;

const STUCK_THRESHOLD_MINUTES = 15;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  // Fail-closed: an unset CRON_SECRET in any environment must NOT silently
  // open this endpoint, since it mutates user state (marks running audits
  // failed, refunds quota).
  if (!cronSecret) {
    console.error("cron.sweep_stuck_audits.no_cron_secret");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Supabase credentials missing" }, { status: 500 });
  }

  const admin = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const threshold = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60_000).toISOString();
  const errorMessage = `Worker did not complete within ${STUCK_THRESHOLD_MINUTES} minutes (likely crashed or OOM)`;

  const { data: stuck, error: readErr } = await admin
    .from("audit_sessions")
    .select("id, user_id, decision_meta")
    .eq("status", "running")
    .lt("pipeline_started_at", threshold);
  if (readErr) {
    console.error("cron.sweep_stuck_audits.read_failed", { error: readErr.message });
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  let swept = 0;
  let refunded = 0;
  for (const row of stuck ?? []) {
    const meta = {
      ...(row.decision_meta ?? {}),
      pipeline_error: errorMessage,
    };
    const { error: updateErr } = await admin
      .from("audit_sessions")
      .update({
        status: "failed",
        decision_meta: meta,
        completed_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "running"); // CAS guard: don't trample a row that completed between our read and write
    if (updateErr) {
      console.error("cron.sweep_stuck_audits.update_failed", {
        id: row.id,
        error: updateErr.message,
      });
      continue;
    }
    swept++;
    if (await refundAuditQuota(admin, row.user_id)) refunded++;
  }

  return NextResponse.json({
    swept,
    refunded,
    thresholdMinutes: STUCK_THRESHOLD_MINUTES,
  });
}

async function refundAuditQuota(
  admin: SupabaseClient,
  userId: string | null,
): Promise<boolean> {
  if (!userId) return false;

  // Users on their own LLM chain don't consume our quota — nothing to refund.
  const { count: chainCount } = await admin
    .from("user_llm_chain_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("enabled", true);
  if ((chainCount ?? 0) > 0) return false;

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("evaluations_used")
    .eq("user_id", userId)
    .maybeSingle();
  if (!subscription) return false;

  const refundedUsed = Math.max(subscription.evaluations_used - 1, 0);
  const { error } = await admin
    .from("subscriptions")
    .update({ evaluations_used: refundedUsed })
    .eq("user_id", userId);
  return !error;
}
