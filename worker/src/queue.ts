import { Queue, Worker, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config.js";

// Upstash requires TLS — force rediss:// scheme if needed
let redisUrl = config.redis.url;
const isUpstash = redisUrl.includes("upstash.io");
if (isUpstash && redisUrl.startsWith("redis://")) {
  redisUrl = redisUrl.replace("redis://", "rediss://");
}

const connection: ConnectionOptions = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const evaluationQueue = new Queue("evaluations", {
  connection,
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 100 },
    removeOnFail: { age: 24 * 3600, count: 100 },
  },
});

export const personaQueue = new Queue("persona-generation", {
  connection,
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 50 },
    removeOnFail: { age: 24 * 3600, count: 50 },
  },
});

// Decision flow queues. See spec
// docs/superpowers/specs/2026-05-06-multi-agent-decision-tool-design.md §4.1.
export const decisionIntakeQueue = new Queue("decision-intake", {
  connection,
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 100 },
    removeOnFail: { age: 24 * 3600, count: 100 },
  },
});

export const decisionOrchestratorQueue = new Queue("decision-orchestrator", {
  connection,
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 100 },
    removeOnFail: { age: 24 * 3600, count: 100 },
  },
});

export const decisionMechanismQueue = new Queue("decision-mechanism", {
  connection,
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 200 },
    removeOnFail: { age: 24 * 3600, count: 200 },
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

export function createWorker(
  processor: (job: import("bullmq").Job) => Promise<unknown>,
  concurrency = 1
) {
  return new Worker("evaluations", processor, {
    connection,
    concurrency,
    drainDelay: 1000,
    stalledInterval: 600_000,
    lockDuration: 60_000,
  });
}
