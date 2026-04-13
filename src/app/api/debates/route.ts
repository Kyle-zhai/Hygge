import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .single();
  if (!sub || sub.plan !== "max") {
    return NextResponse.json({ error: "1v1 Debate requires Max plan" }, { status: 403 });
  }

  const { evaluationId, personaId } = await request.json();
  if (!evaluationId || !personaId) {
    return NextResponse.json({ error: "evaluationId and personaId required" }, { status: 400 });
  }

  const { data: evaluation } = await supabase
    .from("evaluations")
    .select("id, project_id")
    .eq("id", evaluationId)
    .single();

  if (!evaluation) {
    return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", evaluation.project_id)
    .single();

  if (project?.user_id !== user.id) {
    return NextResponse.json({ error: "Not your evaluation" }, { status: 403 });
  }

  const { data: debate, error } = await supabase
    .from("debates")
    .insert({
      evaluation_id: evaluationId,
      persona_id: personaId,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(debate, { status: 201 });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: debates } = await supabase
    .from("debates")
    .select("id, evaluation_id, persona_id, title, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return NextResponse.json(debates || []);
}
