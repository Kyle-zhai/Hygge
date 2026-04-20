import { Queue } from "bullmq";
import IORedis from "ioredis";

let _queue: Queue | null = null;

export function getEvaluationsQueue(): Queue {
  if (_queue) return _queue;
  let redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  // Upstash requires TLS; their dashboard sometimes prints the non-TLS URL.
  if (redisUrl.includes("upstash.io") && redisUrl.startsWith("redis://")) {
    redisUrl = redisUrl.replace("redis://", "rediss://");
  }
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  _queue = new Queue("evaluations", { connection });
  return _queue;
}

export interface EvaluationJobPayload {
  evaluationId: string;
  projectId: string;
  rawInput: string;
  url?: string;
  attachments: string[];
  selectedPersonaIds: string[];
  planTier: string;
  mode: string;
  llmOverrides?: unknown;
}

export async function enqueueEvaluation(payload: EvaluationJobPayload): Promise<void> {
  await getEvaluationsQueue().add("evaluate", payload);
}
