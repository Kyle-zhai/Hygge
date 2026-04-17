import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/stripe/plans";
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
    _queue = new Queue("persona-generation", { connection });
  }
  return _queue;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .single();

  const plan = subscription?.plan ?? "free";
  const planConfig = PLANS[plan as keyof typeof PLANS] ?? PLANS.free;

  if (!planConfig.features.customPersonas) {
    return NextResponse.json({ error: "Custom personas require a Pro or Max plan" }, { status: 403 });
  }

  const limit = planConfig.customPersonasLimit;
  if (limit !== -1) {
    const { count } = await supabase
      .from("personas")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .eq("is_custom", true);

    if ((count ?? 0) >= limit) {
      return NextResponse.json({
        error: `Custom persona limit reached (${limit}). Upgrade to Max for unlimited.`,
      }, { status: 429 });
    }
  }

  const body = await request.json();
  const { name, occupation, personality, background, importedText, avatarUrl } = body;

  if (!name || !occupation || !personality) {
    return NextResponse.json({ error: "name, occupation, and personality are required" }, { status: 400 });
  }

  const llmOverrides = await fetchUserLLMOverrides(user.id);

  try {
    const queue = getQueue();
    const job = await queue.add("generate", {
      userId: user.id,
      name,
      occupation,
      personality,
      background,
      importedText,
      avatarUrl,
      llmOverrides: llmOverrides ?? undefined,
    });

    return NextResponse.json({ jobId: job.id, status: "processing" }, { status: 202 });
  } catch (error: any) {
    console.error("Failed to queue persona generation:", error?.message);
    return NextResponse.json({ error: "Failed to start persona generation" }, { status: 500 });
  }
}
