import { Worker } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config.js";
import { processEvaluation } from "./processors/orchestrator.js";
import { processPersonaGeneration } from "./processors/generate-persona.js";
import { processDebateResponse } from "./processors/debate-response.js";
import { startHttpServer } from "./http-server.js";
import { log } from "./utils/logger.js";

log.info("worker.starting", { node: process.version, pid: process.pid });

let redisUrl = config.redis.url;
if (redisUrl.includes("upstash.io") && redisUrl.startsWith("redis://")) {
  redisUrl = redisUrl.replace("redis://", "rediss://");
}
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const evaluationWorker = new Worker("evaluations", processEvaluation, {
  connection,
  concurrency: 1,
  drainDelay: 30,
  stalledInterval: 60_000,
  lockDuration: 60_000,
});

const personaWorker = new Worker("persona-generation", processPersonaGeneration, {
  connection,
  concurrency: 2,
  drainDelay: 30,
});

const debateWorker = new Worker("debate-response", processDebateResponse, {
  connection,
  concurrency: 3,
  drainDelay: 5,
});

function jobDuration(job: { processedOn?: number; finishedOn?: number }): number | undefined {
  if (!job.processedOn) return undefined;
  const end = job.finishedOn ?? Date.now();
  return end - job.processedOn;
}

function attachLogs(queue: string, worker: Worker) {
  worker.on("completed", (job) => {
    log.info("job.completed", {
      queue,
      jobId: job.id,
      durationMs: jobDuration(job),
      attempts: job.attemptsMade,
      dataKeys: job.data ? Object.keys(job.data) : [],
    });
  });
  worker.on("failed", (job, err) => {
    log.error("job.failed", {
      queue,
      jobId: job?.id,
      durationMs: job ? jobDuration(job) : undefined,
      attempts: job?.attemptsMade,
      error: err.message,
    });
  });
  worker.on("stalled", (jobId) => {
    log.warn("job.stalled", { queue, jobId });
  });
  worker.on("ready", () => log.info("worker.ready", { queue }));
  worker.on("error", (err) => log.error("worker.error", { queue, error: err.message }));
}

attachLogs("evaluations", evaluationWorker);
attachLogs("persona-generation", personaWorker);
attachLogs("debate-response", debateWorker);

const httpServer = startHttpServer();

async function shutdown(signal: string) {
  log.info("worker.shutdown", { signal });
  await Promise.all([
    evaluationWorker.close(),
    personaWorker.close(),
    debateWorker.close(),
    new Promise<void>((resolve) => httpServer.close(() => resolve())),
  ]);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  log.error("process.unhandled_rejection", {
    error: reason instanceof Error ? reason.message : String(reason),
  });
});
process.on("uncaughtException", (err) => {
  log.error("process.uncaught_exception", { error: err.message, stack: err.stack });
  // Intentionally do NOT exit — BullMQ worker stability matters more than a single bad job
});
