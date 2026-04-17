import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ feedback: {} });

  const url = new URL(request.url);
  const evaluationId = url.searchParams.get("evaluation_id");
  if (!evaluationId) {
    return NextResponse.json({ error: "evaluation_id required" }, { status: 400 });
  }

  const { data: reviews } = await supabase
    .from("persona_reviews")
    .select("id")
    .eq("evaluation_id", evaluationId);
  const reviewIds = (reviews ?? []).map((r) => r.id);
  if (reviewIds.length === 0) return NextResponse.json({ feedback: {} });

  const { data } = await supabase
    .from("persona_review_feedback")
    .select("review_id, value")
    .eq("user_id", user.id)
    .in("review_id", reviewIds);

  const feedback: Record<string, number> = {};
  for (const row of data ?? []) feedback[row.review_id] = row.value;
  return NextResponse.json({ feedback });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const reviewId = typeof body.review_id === "string" ? body.review_id : "";
  const personaId = typeof body.persona_id === "string" ? body.persona_id : "";
  const value = Number(body.value);

  if (!reviewId || !personaId || (value !== 1 && value !== -1)) {
    return NextResponse.json(
      { error: "review_id, persona_id, and value (±1) required" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("persona_review_feedback")
    .upsert(
      { user_id: user.id, review_id: reviewId, persona_id: personaId, value },
      { onConflict: "user_id,review_id" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const reviewId = url.searchParams.get("review_id");
  if (!reviewId) return NextResponse.json({ error: "review_id required" }, { status: 400 });

  const { error } = await supabase
    .from("persona_review_feedback")
    .delete()
    .eq("user_id", user.id)
    .eq("review_id", reviewId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
