// API-side queue helpers for the decision flow.
// Mirrors src/lib/queue/evaluations.ts: lazy single instance per queue,
// upstash TLS handling, fire-and-forget enqueue helpers.

import { Queue } from "bullmq";
import IORedis from "ioredis";

let _intakeQueue: Queue | null = null;
let _orchestratorQueue: Queue | null = null;

function buildConnection(): IORedis {
  let redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  if (redisUrl.includes("upstash.io") && redisUrl.startsWith("redis://")) {
    redisUrl = redisUrl.replace("redis://", "rediss://");
  }
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}

export function getDecisionIntakeQueue(): Queue {
  if (_intakeQueue) return _intakeQueue;
  _intakeQueue = new Queue("decision-intake", { connection: buildConnection() });
  return _intakeQueue;
}

export function getDecisionOrchestratorQueue(): Queue {
  if (_orchestratorQueue) return _orchestratorQueue;
  _orchestratorQueue = new Queue("decision-orchestrator", {
    connection: buildConnection(),
  });
  return _orchestratorQueue;
}

export interface DecisionIntakeJobPayload {
  sessionId: string;
}

export async function enqueueDecisionIntake(
  payload: DecisionIntakeJobPayload,
): Promise<void> {
  const queue = getDecisionIntakeQueue();
  // jobId scopes to the session so a flurry of user clicks collapses into
  // one in-flight intake at a time. The processor itself short-circuits if
  // it sees the latest message is already an agent question.
  await queue.add("intake", payload, {
    jobId: `intake:${payload.sessionId}`,
    removeOnComplete: { age: 3600, count: 100 },
    removeOnFail: { age: 24 * 3600, count: 100 },
  });
}

export async function enqueueDecisionOrchestrate(briefId: string): Promise<void> {
  const queue = getDecisionOrchestratorQueue();
  await queue.add(
    "orchestrate",
    { briefId },
    { jobId: `orch:${briefId}`, removeOnComplete: true },
  );
}
