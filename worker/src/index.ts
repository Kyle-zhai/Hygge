import { Sentry, sentryEnabled } from "./sentry.js";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config.js";
import { processEvaluation } from "./processors/orchestrator.js";
import { processPersonaGeneration } from "./processors/generate-persona.js";
import { processDebateResponse } from "./processors/debate-response.js";
import { startHttpServer } from "./http-server.js";
import { supabase } from "./supabase.js";
import { log } from "./utils/logger.js";

log.info("worker.starting", { node: process.version, pid: process.pid });

let redisUrl = config.redis.url;
if (redisUrl.includes("upstash.io") && redisUrl.startsWith("redis://")) {
  redisUrl = redisUrl.replace("redis://", "rediss://");
}
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const evaluationWorker = new Worker("evaluations", processEvaluation, {
  connection,
  concurrency: Number(process.env.EVAL_CONCURRENCY ?? 3),
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

// Mark the evaluation failed and refund the user's monthly quota that was
// consumed at submission time. Refund is skipped for BYOK users (their quota
// was never charged) and clamped at 0 so a stale `failed` event after a
// manual retry can never make `evaluations_used` go negative. Status guard
// (.neq("status", "failed")) prevents double-refund if BullMQ ever re-fires.
async function handleEvaluationFailure(
  evaluationId: string,
  errorMessage: string,
  jobId: string | undefined,
): Promise<void> {
  const { data: updated, error: updateError } = await supabase
    .from("evaluations")
    .update({
      status: "failed",
      error_message: errorMessage.slice(0, 2000),
      failed_at: new Date().toISOString(),
    })
    .eq("id", evaluationId)
    .neq("status", "failed")
    .select("project_id")
    .maybeSingle();

  if (updateError) {
    log.error("job.failed.db_update_failed", { jobId, evaluationId, error: updateError.message });
    return;
  }
  if (!updated) {
    // Already failed — refund already happened (or never happened for BYOK).
    return;
  }

  const { data: project } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", updated.project_id)
    .maybeSingle();
  if (!project?.user_id) return;

  const { count: chainCount } = await supabase
    .from("user_llm_chain_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", project.user_id)
    .eq("enabled", true);
  if ((chainCount ?? 0) > 0) {
    log.info("job.failed.byok_no_refund", { evaluationId, userId: project.user_id });
    return;
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("evaluations_used")
    .eq("user_id", project.user_id)
    .maybeSingle();
  if (!subscription) return;

  const refundedUsed = Math.max(subscription.evaluations_used - 1, 0);
  const { error: refundError } = await supabase
    .from("subscriptions")
    .update({ evaluations_used: refundedUsed })
    .eq("user_id", project.user_id);
  if (refundError) {
    log.error("job.failed.quota_refund_failed", {
      evaluationId,
      userId: project.user_id,
      error: refundError.message,
    });
    return;
  }
  log.info("job.failed.quota_refunded", {
    evaluationId,
    userId: project.user_id,
    evaluationsUsed: refundedUsed,
  });
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

    if (sentryEnabled) {
      Sentry.captureException(err, {
        tags: { queue, jobId: String(job?.id ?? "unknown") },
        extra: { attempts: job?.attemptsMade, data: job?.data },
      });
    }

    if (queue === "evaluations" && job?.data?.evaluationId) {
      const evaluationId = job.data.evaluationId as string;
      void handleEvaluationFailure(evaluationId, err.message, job.id);
    }
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
  if (sentryEnabled) {
    Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
  }
});
process.on("uncaughtException", (err) => {
  log.error("process.uncaught_exception", { error: err.message, stack: err.stack });
  if (sentryEnabled) Sentry.captureException(err);
  // Intentionally do NOT exit — BullMQ worker stability matters more than a single bad job
});
