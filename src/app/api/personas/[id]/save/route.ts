import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitResponse = await enforceRateLimit("personas", user.id);
  if (limitResponse) return limitResponse;

  const { error } = await supabase
    .from("persona_saves")
    .insert({ user_id: user.id, persona_id: id });

  if (error?.code === "23505") {
    return NextResponse.json({ message: "Already saved" });
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Saved" }, { status: 201 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await supabase
    .from("persona_saves")
    .delete()
    .eq("user_id", user.id)
    .eq("persona_id", id);

  return NextResponse.json({ message: "Unsaved" });
}
