import { Queue } from "bullmq";
import IORedis from "ioredis";

let _queue: Queue | null = null;

export function getAuditQueue(): Queue {
  if (_queue) return _queue;
  let redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  if (redisUrl.includes("upstash.io") && redisUrl.startsWith("redis://")) {
    redisUrl = redisUrl.replace("redis://", "rediss://");
  }
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  _queue = new Queue("audit", { connection });
  return _queue;
}

export interface AuditJobPayload {
  auditSessionId: string;
  templateSlug: string;
  decisionText: string;
  decisionMeta: Record<string, unknown>;
  userId: string;
  workspaceId: string | null;
  llmOverrides?: unknown;
}

export async function enqueueAudit(payload: AuditJobPayload): Promise<void> {
  await getAuditQueue().add("audit", payload);
}
