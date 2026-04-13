import { Worker } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config.js";
import { processEvaluation } from "./processors/orchestrator.js";
import { processPersonaGeneration } from "./processors/generate-persona.js";
import { processDebateResponse } from "./processors/debate-response.js";

console.log("Starting Hygge discussion worker...");

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

evaluationWorker.on("completed", (job) => {
  console.log(`[evaluation] Job ${job.id} completed for ${job.data.evaluationId}`);
});
evaluationWorker.on("failed", (job, err) => {
  console.error(`[evaluation] Job ${job?.id} failed:`, err.message);
});

personaWorker.on("completed", (job) => {
  console.log(`[persona-gen] Job ${job.id} completed`);
});
personaWorker.on("failed", (job, err) => {
  console.error(`[persona-gen] Job ${job?.id} failed:`, err.message);
});

debateWorker.on("completed", (job) => {
  console.log(`[debate] Job ${job.id} completed for debate ${job.data.debateId}`);
});
debateWorker.on("failed", (job, err) => {
  console.error(`[debate] Job ${job?.id} failed:`, err.message);
});

evaluationWorker.on("ready", () => console.log("Evaluation worker ready."));
personaWorker.on("ready", () => console.log("Persona generation worker ready."));
debateWorker.on("ready", () => console.log("Debate response worker ready."));

async function shutdown() {
  console.log("Shutting down workers...");
  await Promise.all([evaluationWorker.close(), personaWorker.close(), debateWorker.close()]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
