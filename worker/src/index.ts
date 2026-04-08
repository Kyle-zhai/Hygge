import { createWorker } from "./queue.js";
import { processEvaluation } from "./processors/orchestrator.js";

console.log("Starting Persona evaluation worker...");

const worker = createWorker(processEvaluation);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed for evaluation ${job.data.evaluationId}`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

worker.on("ready", () => {
  console.log("Worker is ready and listening for jobs.");
});

process.on("SIGTERM", async () => {
  console.log("Shutting down worker...");
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Shutting down worker...");
  await worker.close();
  process.exit(0);
});
