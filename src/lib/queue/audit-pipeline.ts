import { Queue } from "bullmq";
import IORedis from "ioredis";

let _queue: Queue | null = null;

export function getAuditPipelineQueue(): Queue {
  if (_queue) return _queue;
  let redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  if (redisUrl.includes("upstash.io") && redisUrl.startsWith("redis://")) {
    redisUrl = redisUrl.replace("redis://", "rediss://");
  }
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  _queue = new Queue("audit-pipeline", { connection });
  return _queue;
}

export interface AuditPipelineJobPayload {
  sessionId: string;
  llmOverrides?: unknown;
  auxLlmOverrides?: unknown;
  replyLanguage?: "en" | "zh";
}

export async function enqueueAuditPipeline(
  payload: AuditPipelineJobPayload,
): Promise<void> {
  await getAuditPipelineQueue().add("pipeline-run", payload, {
    // Default 1 attempt — pipeline failure is rarely transient (usually
    // bad inputs or model JSON drift). Manual retry via /run preferred over
    // burning extra cost.
    attempts: 1,
  });
}
