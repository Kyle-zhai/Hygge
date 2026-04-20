import { NextResponse } from "next/server";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 30;

const STUCK_THRESHOLD_MINUTES = 15;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

  const { data, error } = await admin
    .from("evaluations")
    .update({
      status: "failed",
      error_message: errorMessage,
      failed_at: new Date().toISOString(),
    })
    .eq("status", "processing")
    .lt("created_at", threshold)
    .select("id, project_id");

  if (error) {
    console.error("cron.sweep_stuck_evaluations.failed", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mirror worker.failed: refund the user's monthly quota for each stuck
  // evaluation. The worker crashed before it could refund (that's why we're
  // here). Sequential to keep the loop simple — sweeps are small.
  let refunded = 0;
  for (const row of data ?? []) {
    const ok = await refundQuotaForEvaluation(admin, row.project_id);
    if (ok) refunded++;
  }

  return NextResponse.json({
    swept: data?.length ?? 0,
    ids: data?.map((row) => row.id) ?? [],
    refunded,
    thresholdMinutes: STUCK_THRESHOLD_MINUTES,
  });
}

async function refundQuotaForEvaluation(
  admin: SupabaseClient,
  projectId: string,
): Promise<boolean> {
  const { data: project } = await admin
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project?.user_id) return false;

  const { count: chainCount } = await admin
    .from("user_llm_chain_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", project.user_id);
  if ((chainCount ?? 0) > 0) return false;

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("evaluations_used")
    .eq("user_id", project.user_id)
    .maybeSingle();
  if (!subscription) return false;

  const refundedUsed = Math.max(subscription.evaluations_used - 1, 0);
  const { error } = await admin
    .from("subscriptions")
    .update({ evaluations_used: refundedUsed })
    .eq("user_id", project.user_id);
  return !error;
}
