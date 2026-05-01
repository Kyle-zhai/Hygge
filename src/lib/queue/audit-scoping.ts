import { Queue } from "bullmq";
import IORedis from "ioredis";

let _queue: Queue | null = null;

export function getAuditScopingQueue(): Queue {
  if (_queue) return _queue;
  let redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  if (redisUrl.includes("upstash.io") && redisUrl.startsWith("redis://")) {
    redisUrl = redisUrl.replace("redis://", "rediss://");
  }
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  _queue = new Queue("audit-scoping", { connection });
  return _queue;
}

export interface AuditScopingJobPayload {
  scopingId: string;
  llmOverrides?: unknown;
  replyLanguage?: "en" | "zh";
}

export async function enqueueAuditScoping(payload: AuditScopingJobPayload): Promise<void> {
  await getAuditScopingQueue().add("scoping-turn", payload);
}
