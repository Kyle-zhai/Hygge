import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, owner_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id, role, added_at")
    .eq("workspace_id", id);

  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: authUsers } = await service().auth.admin.listUsers({ page: 1, perPage: 200 });
  const emailById = new Map<string, string>();
  for (const u of authUsers?.users ?? []) {
    if (userIds.includes(u.id) && u.email) emailById.set(u.id, u.email);
  }

  return NextResponse.json({
    workspace: { ...workspace, is_owner: workspace.owner_id === user.id },
    members: (members ?? []).map((m) => ({
      user_id: m.user_id,
      role: m.role,
      added_at: m.added_at,
      email: emailById.get(m.user_id) ?? null,
    })),
  });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("workspaces").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
