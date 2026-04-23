import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: personas, error } = await supabase
    .from("personas")
    .select("id, identity, demographics, description, tags, category, created_at")
    .eq("creator_id", user.id)
    .eq("is_custom", true)
    .eq("is_public", true)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const personaIds = (personas || []).map((p) => p.id);
  const saveCountMap: Record<string, number> = {};
  const usageCountMap: Record<string, number> = {};

  if (personaIds.length > 0) {
    const { data: saves } = await supabase
      .from("persona_saves")
      .select("persona_id")
      .in("persona_id", personaIds);

    for (const s of saves || []) {
      saveCountMap[s.persona_id] = (saveCountMap[s.persona_id] || 0) + 1;
    }

    const { data: reviews } = await supabase
      .from("persona_reviews")
      .select("persona_id")
      .in("persona_id", personaIds);

    for (const r of reviews || []) {
      usageCountMap[r.persona_id] = (usageCountMap[r.persona_id] || 0) + 1;
    }
  }

  const publications = (personas || []).map((p) => ({
    ...p,
    save_count: saveCountMap[p.id] || 0,
    usage_count: usageCountMap[p.id] || 0,
  }));

  return NextResponse.json({ publications });
}
