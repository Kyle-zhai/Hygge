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

  // ── Issue A: ownership check for round_table ────────────────────────────
  if (v.kind === "round_table") {
    const { data: evaluation } = await supabase
      .from("evaluations")
      .select("id, project_id")
      .eq("id", v.evaluationId)
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
  }

  // ── Issue B: ownership check for one_v_one ──────────────────────────────
  if (v.kind === "one_v_one") {
    const { data: dm } = await supabase
      .from("debate_messages")
      .select("debate_id")
      .eq("id", v.debateMessageId)
      .single();

    if (!dm) {
      return NextResponse.json({ error: "Debate message not found" }, { status: 404 });
    }

    const { data: dbt } = await supabase
      .from("debates")
      .select("user_id")
      .eq("id", dm.debate_id)
      .single();

    if (dbt?.user_id !== user.id) {
      return NextResponse.json({ error: "Not your debate" }, { status: 403 });
    }
  }

  // ── Ownership check for decision_mechanism ──────────────────────────────
  if (v.kind === "decision_mechanism") {
    const { data: run } = await supabase
      .from("decision_mechanism_runs")
      .select("brief_id, decision_briefs!inner(decision_sessions!inner(user_id))")
      .eq("id", v.mechanismRunId)
      .single();
    if (!run) {
      return NextResponse.json({ error: "Mechanism run not found" }, { status: 404 });
    }
    const session = (run.decision_briefs as unknown as {
      decision_sessions: { user_id: string };
    }).decision_sessions;
    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Not your decision" }, { status: 403 });
    }
  }

  const row = ((): Record<string, unknown> => {
    if (v.kind === "round_table") {
      return {
        user_id: user.id,
        evaluation_id: v.evaluationId,
        round_number: v.roundNumber,
        message_index: v.messageIndex,
        debate_message_id: null,
        decision_mechanism_run_id: null,
        utterance_index: null,
        persona_id: v.personaId,
        rating: v.rating,
        comment: v.comment ?? null,
      };
    }
    if (v.kind === "one_v_one") {
      return {
        user_id: user.id,
        evaluation_id: null,
        round_number: null,
        message_index: null,
        debate_message_id: v.debateMessageId,
        decision_mechanism_run_id: null,
        utterance_index: null,
        persona_id: v.personaId,
        rating: v.rating,
        comment: v.comment ?? null,
      };
    }
    return {
      user_id: user.id,
      evaluation_id: null,
      round_number: null,
      message_index: null,
      debate_message_id: null,
      decision_mechanism_run_id: v.mechanismRunId,
      utterance_index: v.utteranceIndex,
      persona_id: v.personaId,
      rating: v.rating,
      comment: v.comment ?? null,
    };
  })();

  const onConflict =
    v.kind === "round_table"
      ? "user_id,evaluation_id,round_number,message_index"
      : v.kind === "one_v_one"
      ? "user_id,debate_message_id"
      : "user_id,decision_mechanism_run_id,utterance_index";

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
  } else if (v.kind === "one_v_one") {
    query = query.eq("debate_message_id", v.debateMessageId);
  } else {
    query = query
      .eq("decision_mechanism_run_id", v.mechanismRunId)
      .eq("utterance_index", v.utteranceIndex);
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
    decisionBriefId: url.searchParams.get("decisionBriefId") ?? undefined,
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

  // decisionBriefId path: collect runs under the brief, then their feedback
  if (parsed.data.decisionBriefId) {
    const briefId = parsed.data.decisionBriefId;
    const { data: runs, error: runErr } = await supabase
      .from("decision_mechanism_runs")
      .select("id, decision_briefs!inner(decision_sessions!inner(user_id))")
      .eq("brief_id", briefId);
    if (runErr) return NextResponse.json({ error: runErr.message }, { status: 500 });
    const ownedRunIds = (runs ?? [])
      .filter((r) => {
        const sess = (r.decision_briefs as unknown as {
          decision_sessions: { user_id: string };
        }).decision_sessions;
        return sess.user_id === user.id;
      })
      .map((r: { id: string }) => r.id);
    if (ownedRunIds.length === 0) return NextResponse.json({ feedback: [] });

    const { data, error } = await supabase
      .from("persona_utterance_feedback")
      .select(
        "id, persona_id, decision_mechanism_run_id, utterance_index, rating, comment, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .in("decision_mechanism_run_id", ownedRunIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ feedback: data ?? [] });
  }

  // debateId path: join through debate_messages
  // Issue C: capture error; Issue D: narrow type instead of non-null assertion
  const debateId = parsed.data.debateId;
  if (!debateId) return NextResponse.json({ feedback: [] }); // unreachable per schema refine, but narrows type
  const { data: messageIds, error: msgError } = await supabase
    .from("debate_messages")
    .select("id")
    .eq("debate_id", debateId);
  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });
  const ids = (messageIds ?? []).map((m: { id: string }) => m.id);
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
