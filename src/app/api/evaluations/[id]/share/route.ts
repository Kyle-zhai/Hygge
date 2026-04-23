import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

async function assertOwner(supabase: Awaited<ReturnType<typeof createClient>>, evaluationId: string, userId: string) {
  const { data, error } = await supabase
    .from("evaluations")
    .select("id, project_id, status, share_token, projects!inner(user_id)")
    .eq("id", evaluationId)
    .single();
  if (error || !data) return null;
  const ownerId = (data as { projects?: { user_id?: string } | null }).projects?.user_id;
  if (ownerId !== userId) return null;
  return data as { id: string; status: string; share_token: string | null };
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const evaluation = await assertOwner(supabase, id, user.id);
  if (!evaluation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (evaluation.status !== "completed") {
    return NextResponse.json({ error: "Evaluation not completed" }, { status: 400 });
  }

  if (evaluation.share_token) {
    return NextResponse.json({ token: evaluation.share_token });
  }

  const token = generateToken();
  const { error: updateError } = await supabase
    .from("evaluations")
    .update({ share_token: token, shared_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ token }, { status: 201 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const evaluation = await assertOwner(supabase, id, user.id);
  if (!evaluation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("evaluations")
    .update({ share_token: null, shared_at: null })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Revoked" });
}
