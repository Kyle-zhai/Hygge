import { Queue, Worker, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config.js";

const connection: ConnectionOptions = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null,
});

export const evaluationQueue = new Queue("evaluations", { connection });

export function createWorker(
  processor: Parameters<typeof Worker>[1],
  concurrency = 1
) {
  return new Worker("evaluations", processor, {
    connection,
    concurrency,
  });
}
