import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: personas, error } = await supabase
    .from("personas")
    .select(
      "id, identity, demographics, social_context, financial_profile, psychology, behaviors, evaluation_lens, life_narrative, internal_conflicts, contextual_behaviors, latent_needs, system_prompt, category, is_public, is_custom, source, description, tags, created_at"
    )
    .eq("creator_id", user.id)
    .eq("is_custom", true)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("My personas fetch error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ personas: personas ?? [] });
}
