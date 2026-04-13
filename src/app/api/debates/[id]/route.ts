import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: debate } = await supabase
    .from("debates")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: messages } = await supabase
    .from("debate_messages")
    .select("*")
    .eq("debate_id", id)
    .order("created_at", { ascending: true });

  const { data: persona } = await supabase
    .from("personas")
    .select("id, identity, demographics")
    .eq("id", debate.persona_id)
    .single();

  return NextResponse.json({ debate, messages: messages || [], persona });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("debates").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
