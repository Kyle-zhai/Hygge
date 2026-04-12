import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: official, error } = await supabase
    .from("personas")
    .select("id, identity, demographics, evaluation_lens, category, is_custom, description, tags")
    .eq("is_active", true)
    .eq("is_custom", false)
    .order("category");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let custom: any[] = [];
  let saved: any[] = [];

  if (user) {
    const [customRes, savesRes] = await Promise.all([
      supabase
        .from("personas")
        .select("id, identity, demographics, evaluation_lens, category, is_custom, description, tags")
        .eq("creator_id", user.id)
        .eq("is_custom", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("persona_saves")
        .select("persona_id, personas(id, identity, demographics, evaluation_lens, category, is_custom, description, tags)")
        .eq("user_id", user.id),
    ]);

    custom = customRes.data ?? [];
    saved = (savesRes.data ?? [])
      .map((s: any) => s.personas)
      .filter(Boolean);
  }

  const customIds = new Set(custom.map((p) => p.id));
  const officialIds = new Set((official ?? []).map((p) => p.id));
  const dedupedSaved = saved.filter((p) => !customIds.has(p.id) && !officialIds.has(p.id));

  return NextResponse.json({
    personas: [
      ...(official ?? []).map((p) => ({ ...p, _source: "official" })),
      ...custom.map((p) => ({ ...p, _source: "custom" })),
      ...dedupedSaved.map((p) => ({ ...p, _source: "saved" })),
    ],
  });
}
