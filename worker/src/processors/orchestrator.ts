import type { Job } from "bullmq";
import { OfficeParser } from "officeparser";
import { supabase } from "../supabase.js";
import { OpenAICompatibleLLM } from "../llm/openai-compatible.js";
import { buildLLM, buildVisionLLM, type LLMOverrides } from "../llm/factory.js";
import type { MediaItem } from "../llm/adapter.js";
import { config } from "../config.js";
import { parseProject } from "./parse-project.js";
import { classifyTopic } from "./classify-topic.js";
import { generatePersonaReview } from "./persona-review.js";
import { generateSummaryReport, generateTopicSummaryReport } from "./summary-report.js";
import { runScenarioSimulation } from "./scenario-simulation.js";
import { generateOpinionDrift } from "./opinion-drift.js";
import { runRoundTableDebate } from "./round-table-debate.js";
import type { Persona } from "../types/persona.js";
import type { TopicClassification } from "../types/evaluation.js";
import { log, withTiming } from "../utils/logger.js";

interface EvaluationJobData {
  evaluationId: string;
  projectId: string;
  rawInput: string;
  url?: string;
  attachments?: string[];
  selectedPersonaIds: string[];
  planTier: "free" | "pro" | "max";
  mode: "product" | "topic";
  comparisonBaseId?: string;
  llmOverrides?: LLMOverrides;
}

export async function processEvaluation(job: Job<EvaluationJobData>) {
  const { evaluationId, projectId, rawInput, url, attachments, selectedPersonaIds, planTier, mode, comparisonBaseId, llmOverrides } = job.data;
  const llm = buildLLM(llmOverrides);
  const startedAt = Date.now();
  const ctx = { evaluationId, projectId, mode, planTier, personaCount: selectedPersonaIds.length };

  log.info("orchestrator.start", { ...ctx, hasAttachments: !!attachments?.length, hasUrl: !!url, isComparison: !!comparisonBaseId });

  try {
    // 1. Update status to processing
    await supabase.from("evaluations").update({ status: "processing" }).eq("id", evaluationId);

    // 2. Parse user submission — separate text descriptions from media items
    const attachmentDescriptions: string[] = [];
    const mediaItems: MediaItem[] = [];
    if (attachments && attachments.length > 0) {
      for (const path of attachments) {
        const filename = path.split("/").pop() ?? path;
        const ext = filename.split(".").pop()?.toLowerCase() ?? "";
        const isImage = /^(png|jpg|jpeg|gif|webp)$/.test(ext);
        const isVideo = /^(mp4|mov|avi|webm|mkv)$/.test(ext);
        const isDocument = /^(pdf|docx|pptx)$/.test(ext);

        if (isVideo) {
          const { data: urlData } = await supabase.storage.from("attachments").createSignedUrl(path, 3600);
          if (urlData?.signedUrl) {
            mediaItems.push({ type: "video", url: urlData.signedUrl });
            attachmentDescriptions.push(`[Video attachment: ${filename}]`);
          }
          continue;
        }

        const { data } = await supabase.storage.from("attachments").download(path);
        if (!data) continue;

        if (isImage) {
          const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");
          const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
          mediaItems.push({ type: "image", url: `data:${mime};base64,${base64}` });
          attachmentDescriptions.push(`[Image attachment: ${filename}]`);
        } else if (isDocument) {
          try {
            const buffer = Buffer.from(await data.arrayBuffer());
            const ast = await OfficeParser.parseOffice(buffer);
            const text = ast.toText().slice(0, 8000);
            attachmentDescriptions.push(`[Document: ${filename}]\n${text}`);
          } catch (parseErr) {
            log.warn("orchestrator.attachment.parse_failed", {
              ...ctx,
              filename,
              error: parseErr instanceof Error ? parseErr.message : String(parseErr),
            });
            attachmentDescriptions.push(`[Document: ${filename} — could not extract text]`);
          }
        } else {
          try {
            const text = await data.text();
            attachmentDescriptions.push(`[Attachment: ${filename}]\n${text.slice(0, 5000)}`);
          } catch {
            attachmentDescriptions.push(`[Attachment: ${filename} — binary file]`);
          }
        }
      }
    }

    // Use vision model when media attachments are present, text model otherwise
    const parseLlm = mediaItems.length > 0 ? buildVisionLLM(llmOverrides) : llm;
    const parseTask = parseProject(parseLlm, rawInput, url, attachmentDescriptions, mediaItems);

    let classification: TopicClassification;
    let parsedData: import("../types/evaluation.js").ProjectParsedData;

    if (comparisonBaseId) {
      const { data: baseEval } = await supabase
        .from("evaluations")
        .select("topic_classification")
        .eq("id", comparisonBaseId)
        .single();
      if (!baseEval?.topic_classification) {
        throw new Error("Base evaluation has no topic_classification for compare");
      }
      classification = baseEval.topic_classification as TopicClassification;
      parsedData = await withTiming("orchestrator.parse_project", ctx, () => parseTask);
    } else {
      const [pd, cl] = await Promise.all([
        withTiming("orchestrator.parse_project", ctx, () => parseTask),
        withTiming("orchestrator.classify_topic", ctx, () => classifyTopic(llm, rawInput)),
      ]);
      parsedData = pd;
      classification = cl;
    }

    await supabase.from("projects").update({ parsed_data: parsedData }).eq("id", projectId);

    const dimensions = classification.dimensions;
    log.info("orchestrator.classified", {
      ...ctx,
      topicType: classification.topic_type,
      dimensions: dimensions.map((d) => d.key),
      reusedFromBase: !!comparisonBaseId,
    });
    await supabase.from("evaluations").update({ topic_classification: classification }).eq("id", evaluationId);

    // 4. Fetch selected personas
    const { data: personas } = await supabase.from("personas").select("*").in("id", selectedPersonaIds);
    if (!personas || personas.length === 0) {
      throw new Error("No personas found for selected IDs");
    }

    // 5. Generate individual persona perspectives (parallel with concurrency limit)
    const reviews: Array<{
      persona_id: string;
      persona_name: string;
      scores: import("../types/evaluation.js").EvaluationScores;
      review_text: string;
      strengths: string[];
      weaknesses: string[];
      llm_model: string;
    }> = [];

    let completedCount = 0;
    const personaList = personas as Persona[];
    const reviewsStartedAt = Date.now();

    const batchResults = await Promise.all(
      personaList.map(async (persona) => {
        const review = await withTiming(
          "orchestrator.persona_review",
          { ...ctx, personaId: persona.id, personaName: persona.identity.name },
          () => generatePersonaReview(llm, persona, parsedData, rawInput, dimensions, mode),
        );

        await supabase.from("persona_reviews").insert({
          evaluation_id: evaluationId,
          persona_id: persona.id,
          scores: review.scores,
          review_text: review.review_text,
          strengths: review.strengths,
          weaknesses: review.weaknesses,
          llm_model: review.llm_model,
          overall_stance: review.overall_stance ?? null,
          cited_references: review.cited_references ?? [],
        });

        completedCount++;
        await job.updateProgress(Math.round((completedCount / personaList.length) * 80));

        return {
          persona_id: persona.id,
          persona_name: persona.identity.name,
          ...review,
        };
      })
    );
    reviews.push(...batchResults);
    log.info("orchestrator.reviews_done", {
      ...ctx,
      reviewCount: reviews.length,
      durationMs: Date.now() - reviewsStartedAt,
    });

    // 6. Summary report, scenario sim, and opinion drift all depend on reviews
    //    but are independent of each other — run them in parallel.
    log.info("orchestrator.synthesis_start", { ...ctx });
    const summaryTask = withTiming(
      mode === "topic" ? "orchestrator.topic_summary" : "orchestrator.summary",
      ctx,
      () =>
        mode === "topic" && dimensions
          ? generateTopicSummaryReport(llm, parsedData, reviews, rawInput, dimensions)
          : generateSummaryReport(llm, parsedData, reviews, rawInput, dimensions),
    );

    const scenarioTask = planTier === "max"
      ? withTiming("orchestrator.scenario_sim", ctx, () =>
          runScenarioSimulation(llm, personas as Persona[], reviews),
        ).catch((simError) => {
          log.warn("orchestrator.scenario_sim.skipped", {
            ...ctx,
            error: simError instanceof Error ? simError.message : String(simError),
          });
          return null;
        })
      : Promise.resolve(null);

    const driftTask = planTier === "pro" || planTier === "max"
      ? withTiming("orchestrator.opinion_drift", ctx, () =>
          generateOpinionDrift(llm, personas as Persona[], reviews),
        ).catch((driftError) => {
          log.warn("orchestrator.opinion_drift.skipped", {
            ...ctx,
            error: driftError instanceof Error ? driftError.message : String(driftError),
          });
          return null;
        })
      : Promise.resolve(null);

    const debateTask = planTier === "max"
      ? withTiming("orchestrator.round_table", ctx, () =>
          runRoundTableDebate(llm, personaList, reviews),
        ).catch((debateError) => {
          log.warn("orchestrator.round_table.skipped", {
            ...ctx,
            error: debateError instanceof Error ? debateError.message : String(debateError),
          });
          return null;
        })
      : Promise.resolve(null);

    const [summaryReport, simulation, drift, debate] = await Promise.all([summaryTask, scenarioTask, driftTask, debateTask]);
    summaryReport.scenario_simulation = simulation;
    summaryReport.round_table_debate = debate;
    summaryReport.opinion_drift = drift && drift.length > 0 ? drift : null;
    log.info("orchestrator.synthesis_done", {
      ...ctx,
      driftCount: drift?.length ?? 0,
      hasDebate: !!debate,
      hasSimulation: !!simulation,
    });

    await job.updateProgress(95);

    // 8. Write summary report to DB
    const { error: reportInsertError } = await supabase.from("summary_reports").insert({
      evaluation_id: evaluationId,
      ...summaryReport,
    });
    if (reportInsertError) {
      throw new Error(`Failed to save summary report: ${reportInsertError.message}`);
    }

    // 9. Mark evaluation as completed
    await supabase.from("evaluations").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", evaluationId);

    await job.updateProgress(100);
    log.info("orchestrator.complete", { ...ctx, durationMs: Date.now() - startedAt });
    return { success: true, evaluationId };
  } catch (error: any) {
    log.error("orchestrator.failed", {
      ...ctx,
      durationMs: Date.now() - startedAt,
      error: error?.message ?? String(error),
      stack: error?.stack,
    });
    await supabase.from("evaluations").update({ status: "failed" }).eq("id", evaluationId);
    throw error;
  }
}
