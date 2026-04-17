import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchEffectivePlan } from "@/lib/billing/effective-plan";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { fetchUserLLMOverrides } from "@/lib/llm/user-overrides";

let _queue: Queue | null = null;
function getQueue(): Queue {
  if (!_queue) {
    let redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    if (redisUrl.includes("upstash.io") && redisUrl.startsWith("redis://")) {
      redisUrl = redisUrl.replace("redis://", "rediss://");
    }
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    _queue = new Queue("debate-response", { connection });
  }
  return _queue;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: debateId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const effective = await fetchEffectivePlan(supabase, user.id);
  if (!effective || !effective.features.roundTableDebate) {
    return NextResponse.json({ error: "1v1 Debate requires Max plan or BYOK" }, { status: 403 });
  }

  const { data: debate } = await supabase
    .from("debates")
    .select("id, user_id")
    .eq("id", debateId)
    .eq("user_id", user.id)
    .single();

  if (!debate) return NextResponse.json({ error: "Debate not found" }, { status: 404 });

  const { content } = await request.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "Message content required" }, { status: 400 });
  }

  const { data: message, error } = await supabase
    .from("debate_messages")
    .insert({ debate_id: debateId, role: "user", content: content.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const llmOverrides = await fetchUserLLMOverrides(user.id);

  const queue = getQueue();
  await queue.add("respond", {
    debateId,
    userMessageId: message.id,
    llmOverrides: llmOverrides ?? undefined,
  });

  return NextResponse.json(message, { status: 201 });
}
