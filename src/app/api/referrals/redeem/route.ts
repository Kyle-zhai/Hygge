import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isValidReferralCode } from "@/lib/referrals/code";

export const maxDuration = 10;

const BONUS_EVALUATIONS = 3;

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitResponse = await enforceRateLimit("personas", user.id);
  if (limitResponse) return limitResponse;

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

  if (!isValidReferralCode(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const { data: referralCode } = await supabase
    .from("referral_codes")
    .select("code, user_id")
    .eq("code", code)
    .maybeSingle();

  if (!referralCode) {
    return NextResponse.json({ error: "Code not found" }, { status: 404 });
  }
  if (referralCode.user_id === user.id) {
    return NextResponse.json({ error: "Cannot redeem your own code" }, { status: 400 });
  }

  // Idempotent: unique(referee_id) in schema ensures only the first redeem wins.
  const admin = getAdminClient();
  const { error: insertError } = await admin
    .from("referrals")
    .insert({
      code,
      referrer_id: referralCode.user_id,
      referee_id: user.id,
      bonus_granted: true,
    });

  if (insertError) {
    if (insertError.message.toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: "Already redeemed" }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Grant bonus evaluations to the referee. We read-modify-write instead of
  // an RPC so we don't depend on a Postgres function being installed.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("evaluations_limit")
    .eq("user_id", user.id)
    .single();
  if (sub) {
    await admin
      .from("subscriptions")
      .update({ evaluations_limit: sub.evaluations_limit + BONUS_EVALUATIONS })
      .eq("user_id", user.id);
  }

  return NextResponse.json({ bonus: BONUS_EVALUATIONS });
}
