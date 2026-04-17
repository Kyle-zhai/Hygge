import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id: workspaceId, userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = workspace.owner_id === user.id;
  const isSelf = userId === user.id;
  if (!isOwner && !isSelf) {
    return NextResponse.json({ error: "Only the owner can remove other members" }, { status: 403 });
  }

  if (userId === workspace.owner_id) {
    return NextResponse.json({ error: "Cannot remove the workspace owner" }, { status: 400 });
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
