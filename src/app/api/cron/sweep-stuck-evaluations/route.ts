import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

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
    .select("id");

  if (error) {
    console.error("cron.sweep_stuck_evaluations.failed", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    swept: data?.length ?? 0,
    ids: data?.map((row) => row.id) ?? [],
    thresholdMinutes: STUCK_THRESHOLD_MINUTES,
  });
}
