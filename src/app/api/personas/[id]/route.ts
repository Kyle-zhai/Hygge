import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: persona, error } = await supabase
    .from("personas")
    .select(
      "id, identity, demographics, psychology, evaluation_lens, life_narrative, latent_needs, behaviors, system_prompt, description, tags, is_public, is_custom, source, creator_id"
    )
    .eq("id", id)
    .eq("creator_id", user.id)
    .eq("is_custom", true)
    .eq("is_active", true)
    .single();

  if (error || !persona) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  return NextResponse.json({ persona });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitResponse = await enforceRateLimit("personas", user.id);
  if (limitResponse) return limitResponse;

  const { data: existing } = await supabase
    .from("personas")
    .select("id, creator_id, is_custom, identity, demographics")
    .eq("id", id)
    .single();

  if (!existing || existing.creator_id !== user.id || !existing.is_custom) {
    return NextResponse.json({ error: "Persona not found or not editable" }, { status: 404 });
  }

  const body = await req.json();
  const { name, tagline, avatar, occupation, description, tags } = body;

  const updates: Record<string, unknown> = {};

  if (name !== undefined || tagline !== undefined || avatar !== undefined) {
    const identity = { ...existing.identity };
    if (name !== undefined) {
      identity.name = name;
      if (identity.locale_variants?.en) identity.locale_variants.en.name = name;
    }
    if (tagline !== undefined) identity.tagline = tagline;
    if (avatar !== undefined) identity.avatar = avatar;
    updates.identity = identity;
  }

  if (occupation !== undefined) {
    updates.demographics = { ...existing.demographics, occupation };
  }

  if (description !== undefined) updates.description = description;
  if (tags !== undefined) updates.tags = tags;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const admin = getAdminClient();
  const { error } = await admin
    .from("personas")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitResponse = await enforceRateLimit("personas", user.id);
  if (limitResponse) return limitResponse;

  const { data: persona } = await supabase
    .from("personas")
    .select("id, creator_id, is_custom")
    .eq("id", id)
    .single();

  if (!persona || persona.creator_id !== user.id) {
    return NextResponse.json(
      { error: "Persona not found or not owned by you" },
      { status: 404 }
    );
  }

  if (!persona.is_custom) {
    return NextResponse.json(
      { error: "Only custom personas can be deleted" },
      { status: 400 }
    );
  }

  const admin = getAdminClient();
  const { error } = await admin
    .from("personas")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Persona deleted" });
}
