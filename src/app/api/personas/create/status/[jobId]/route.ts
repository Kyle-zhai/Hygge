import { NextResponse } from "next/server";
import { Queue } from "bullmq";
import IORedis from "ioredis";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const queue = getQueue();
  const job = await queue.getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const state = await job.getState();

  if (state === "completed") {
    return NextResponse.json({
      status: "completed",
      persona: job.returnvalue?.persona ?? null,
    });
  }

  if (state === "failed") {
    return NextResponse.json({
      status: "failed",
      error: job.failedReason ?? "Unknown error",
    });
  }

  return NextResponse.json({ status: "processing" });
}
