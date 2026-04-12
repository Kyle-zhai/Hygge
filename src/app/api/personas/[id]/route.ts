import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase
    .from("personas")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Persona deleted" });
}
