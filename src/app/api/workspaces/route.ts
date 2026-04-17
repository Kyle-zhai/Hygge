import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces!inner(id, name, owner_id, created_at)")
    .eq("user_id", user.id);

  const workspaces = (memberships ?? []).map((m: any) => ({
    id: m.workspaces.id,
    name: m.workspaces.name,
    owner_id: m.workspaces.owner_id,
    created_at: m.workspaces.created_at,
    role: m.role,
    is_owner: m.workspaces.owner_id === user.id,
  }));

  return NextResponse.json({ workspaces });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { data: workspace, error: insertError } = await supabase
    .from("workspaces")
    .insert({ name, owner_id: user.id })
    .select("id, name, owner_id, created_at")
    .single();

  if (insertError || !workspace) {
    return NextResponse.json({ error: insertError?.message ?? "Failed to create" }, { status: 500 });
  }

  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, user_id: user.id, role: "owner" });

  if (memberError) {
    await supabase.from("workspaces").delete().eq("id", workspace.id);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ workspace: { ...workspace, role: "owner", is_owner: true } });
}
