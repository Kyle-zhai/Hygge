import { Queue, Worker, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config.js";

const redisUrl = config.redis.url;
const isUpstash = redisUrl.includes("upstash.io");

const connection: ConnectionOptions = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  tls: isUpstash ? { rejectUnauthorized: false } : undefined,
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
