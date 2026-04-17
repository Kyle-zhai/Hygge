import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: persona, error } = await supabase
    .from("personas")
    .select(
      "id, identity, demographics, psychology, evaluation_lens, life_narrative, latent_needs, behaviors, description, tags, uses_count, source, creator_id, scenarios",
    )
    .eq("id", id)
    .eq("is_public", true)
    .eq("is_custom", true)
    .eq("is_active", true)
    .single();

  if (error || !persona) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  const { data: stats } = await supabase
    .from("persona_marketplace_stats")
    .select("review_count, average_rating")
    .eq("persona_id", id)
    .maybeSingle();

  const { data: { user } } = await supabase.auth.getUser();
  let isSaved = false;
  if (user) {
    const { data: save } = await supabase
      .from("persona_saves")
      .select("persona_id")
      .eq("user_id", user.id)
      .eq("persona_id", id)
      .maybeSingle();
    isSaved = !!save;
  }

  return NextResponse.json({
    persona,
    stats: stats ?? { review_count: 0, average_rating: null },
    is_saved: isSaved,
    can_review: !!user && user.id !== persona.creator_id,
  });
}
