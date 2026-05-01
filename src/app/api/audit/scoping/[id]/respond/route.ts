import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchUserLLMOverrides } from "@/lib/llm/user-overrides";
import { enqueueAuditScoping } from "@/lib/queue/audit-scoping";

export const maxDuration = 10;

const VALID_LANGS = new Set(["en", "zh"]);
const MAX_ANSWER_CHARS = 4000;

interface Ctx {
  params: Promise<{ id: string }>;
}

interface RespondBody {
  answer?: string;
  reply_language?: string;
}

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: RespondBody;
  try {
    body = (await request.json()) as RespondBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const answer = body.answer?.toString().trim();
  if (!answer) return NextResponse.json({ error: "answer required" }, { status: 400 });
  if (answer.length > MAX_ANSWER_CHARS) {
    return NextResponse.json(
      { error: `answer exceeds ${MAX_ANSWER_CHARS} characters` },
      { status: 413 },
    );
  }
  const replyLanguage: "en" | "zh" =
    body.reply_language && VALID_LANGS.has(body.reply_language)
      ? (body.reply_language as "en" | "zh")
      : "en";

  // RPC enforces "must be in awaiting_user with a pending_question". RLS on the
  // table additionally scopes the row to the audit owner.
  const { data, error } = await supabase.rpc("record_scoping_answer", {
    p_scoping_id: id,
    p_answer: answer,
  });
  if (error) {
    const msg = error.message || "record_scoping_answer failed";
    const status = /no pending question|not found/.test(msg) ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  // Re-enqueue a turn so the worker resumes the loop.
  const llmOverrides = await fetchUserLLMOverrides(user.id);
  try {
    await enqueueAuditScoping({
      scopingId: id,
      llmOverrides: llmOverrides ?? undefined,
      replyLanguage,
    });
  } catch (queueErr) {
    console.error("Failed to re-enqueue scoping after answer:", queueErr);
    return NextResponse.json(
      { error: "Scoping service temporarily unavailable. Please retry." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, scoping: data });
}
