import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("persona_marketplace_reviews")
    .select("id, rating, content, created_at, author_id")
    .eq("persona_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reviews: data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const rating = Number(body.rating);
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating must be an integer 1-5" }, { status: 400 });
  }

  const { data: persona } = await supabase
    .from("personas")
    .select("id, creator_id, is_public, is_custom, is_active")
    .eq("id", id)
    .single();

  if (!persona || !persona.is_public || !persona.is_custom || !persona.is_active) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }
  if (persona.creator_id === user.id) {
    return NextResponse.json({ error: "Cannot review your own persona" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("persona_marketplace_reviews")
    .upsert(
      {
        persona_id: id,
        author_id: user.id,
        rating,
        content: content || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "persona_id,author_id" },
    )
    .select("id, rating, content, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ review: data }, { status: 201 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("persona_marketplace_reviews")
    .delete()
    .eq("persona_id", id)
    .eq("author_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Deleted" });
}
