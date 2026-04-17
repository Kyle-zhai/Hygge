import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: personas, error } = await supabase
    .from("personas")
    .select("id, identity, demographics, evaluation_lens, category, is_custom, creator_id, domain, sub_domain, dimensions, product_category, product_traits")
    .eq("is_active", true)
    .order("category");

  if (error) {
    console.error("Personas fetch error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let savedIds: string[] = [];
  let preferredIds: string[] = [];
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const [savesRes, prefsRes] = await Promise.all([
      supabase.from("persona_saves").select("persona_id").eq("user_id", user.id),
      supabase
        .from("persona_user_preferences")
        .select("persona_id, net_score")
        .eq("user_id", user.id)
        .gt("net_score", 0)
        .order("net_score", { ascending: false }),
    ]);
    savedIds = (savesRes.data || []).map((s: { persona_id: string }) => s.persona_id);
    preferredIds = (prefsRes.data || []).map((p: { persona_id: string }) => p.persona_id);
  }

  return NextResponse.json({ personas, savedIds, preferredIds });
}
