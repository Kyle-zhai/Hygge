import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const tag = url.searchParams.get("tag") ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("personas")
    .select("id, identity, demographics, evaluation_lens, category, description, tags, uses_count, creator_id, source", { count: "exact" })
    .eq("is_public", true)
    .eq("is_custom", true)
    .order("uses_count", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`identity->>name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (tag) {
    query = query.contains("tags", [tag]);
  }

  const { data: personas, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  let savedIds: string[] = [];
  if (user) {
    const { data: saves } = await supabase
      .from("persona_saves")
      .select("persona_id")
      .eq("user_id", user.id);
    savedIds = saves?.map((s: any) => s.persona_id) ?? [];
  }

  return NextResponse.json({
    personas: (personas ?? []).map((p: any) => ({ ...p, is_saved: savedIds.includes(p.id) })),
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
  });
}
