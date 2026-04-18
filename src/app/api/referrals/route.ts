import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { generateReferralCode } from "@/lib/referrals/code";

export const maxDuration = 10;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing } = await supabase
    .from("referral_codes")
    .select("code, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { count } = await supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_id", user.id);
    return NextResponse.json({ code: existing.code, referral_count: count ?? 0 });
  }

  const limitResponse = await enforceRateLimit("personas", user.id);
  if (limitResponse) return limitResponse;

  // Retry briefly on unique-constraint collision (generated codes are ~30^8).
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateReferralCode();
    const { data, error } = await supabase
      .from("referral_codes")
      .insert({ user_id: user.id, code })
      .select("code")
      .single();
    if (!error && data) return NextResponse.json({ code: data.code, referral_count: 0 });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Failed to allocate code" }, { status: 500 });
}
