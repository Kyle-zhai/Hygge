import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { PostBodySchema, DeleteBodySchema, GetQuerySchema } from "./schema";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitResponse = await enforceRateLimit("feedback", user.id);
  if (limitResponse) return limitResponse;

  const body = await request.json().catch(() => null);
  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const v = parsed.data;

  const row =
    v.kind === "round_table"
      ? {
          user_id: user.id,
          evaluation_id: v.evaluationId,
          round_number: v.roundNumber,
          message_index: v.messageIndex,
          debate_message_id: null,
          persona_id: v.personaId,
          rating: v.rating,
          comment: v.comment ?? null,
        }
      : {
          user_id: user.id,
          evaluation_id: null,
          round_number: null,
          message_index: null,
          debate_message_id: v.debateMessageId,
          persona_id: v.personaId,
          rating: v.rating,
          comment: v.comment ?? null,
        };

  const onConflict =
    v.kind === "round_table"
      ? "user_id,evaluation_id,round_number,message_index"
      : "user_id,debate_message_id";

  const { data, error } = await supabase
    .from("persona_utterance_feedback")
    .upsert(row, { onConflict })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = DeleteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const v = parsed.data;

  let query = supabase.from("persona_utterance_feedback").delete().eq("user_id", user.id);
  if (v.kind === "round_table") {
    query = query
      .eq("evaluation_id", v.evaluationId)
      .eq("round_number", v.roundNumber)
      .eq("message_index", v.messageIndex);
  } else {
    query = query.eq("debate_message_id", v.debateMessageId);
  }
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const parsed = GetQuerySchema.safeParse({
    evaluationId: url.searchParams.get("evaluationId") ?? undefined,
    debateId: url.searchParams.get("debateId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.evaluationId) {
    const { data, error } = await supabase
      .from("persona_utterance_feedback")
      .select(
        "id, persona_id, evaluation_id, round_number, message_index, rating, comment, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .eq("evaluation_id", parsed.data.evaluationId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ feedback: data ?? [] });
  }

  // debateId path: join through debate_messages
  const { data: messageIds } = await supabase
    .from("debate_messages")
    .select("id")
    .eq("debate_id", parsed.data.debateId!);
  const ids = (messageIds ?? []).map((m) => m.id);
  if (ids.length === 0) return NextResponse.json({ feedback: [] });

  const { data, error } = await supabase
    .from("persona_utterance_feedback")
    .select(
      "id, persona_id, debate_message_id, rating, comment, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .in("debate_message_id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback: data ?? [] });
}
