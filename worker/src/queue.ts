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

export const evaluationQueue = new Queue("evaluations", { connection });

export function createWorker(
  processor: (job: import("bullmq").Job) => Promise<unknown>,
  concurrency = 1
) {
  return new Worker("evaluations", processor, {
    connection,
    concurrency,
  });
}
