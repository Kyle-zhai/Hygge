import type { Job } from "bullmq";
import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import { OfficeParser } from "officeparser";
import { pdfToPng } from "pdf-to-png-converter";
import { supabase } from "../supabase.js";
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
  planTier: "free" | "pro" | "max" | "byok";
  mode: "product" | "topic";
  comparisonBaseId?: string;
  llmOverrides?: LLMOverrides;
}

const MAX_RAW_INPUT_BYTES = 32 * 1024;
// Caps that keep vision-token spend bounded even when users upload 50-page PDFs
// or docx files that embed the same logo image 40 times.
const MAX_IMAGES_PER_EVAL = 12;
const MAX_PDF_PAGES = 8;
const ARCHIVE_IMAGE_RE = /\.(png|jpe?g|gif|webp)$/i;
const ARCHIVE_MEDIA_PREFIXES = ["word/media/", "ppt/media/", "xl/media/"];

function mimeForExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "png") return "image/png";
  if (e === "gif") return "image/gif";
  if (e === "webp") return "image/webp";
  return "image/png";
}

function pushDedupedImage(
  mediaItems: MediaItem[],
  seen: Set<string>,
  mime: string,
  buffer: Buffer,
): boolean {
  if (mediaItems.filter((m) => m.type === "image").length >= MAX_IMAGES_PER_EVAL) return false;
  const hash = createHash("sha1").update(buffer).digest("hex");
  if (seen.has(hash)) return false;
  seen.add(hash);
  mediaItems.push({ type: "image", url: `data:${mime};base64,${buffer.toString("base64")}` });
  return true;
}

export async function processEvaluation(job: Job<EvaluationJobData>) {
  const { evaluationId, projectId, rawInput, url, attachments, selectedPersonaIds, planTier, mode, comparisonBaseId, llmOverrides } = job.data;
  const llm = buildLLM(llmOverrides);
  const startedAt = Date.now();
  const ctx = { evaluationId, projectId, mode, planTier, personaCount: selectedPersonaIds.length };

  log.info("orchestrator.start", { ...ctx, hasAttachments: !!attachments?.length, hasUrl: !!url, isComparison: !!comparisonBaseId });

  // Defense-in-depth: the API already caps rawInput, but a legacy job or direct queue
  // injection could still carry a huge payload into N persona-review LLM calls.
  const rawInputBytes = Buffer.byteLength(rawInput ?? "", "utf8");
  if (rawInputBytes > MAX_RAW_INPUT_BYTES) {
    log.error("orchestrator.raw_input_too_large", { ...ctx, rawInputBytes, limit: MAX_RAW_INPUT_BYTES });
    await supabase.from("evaluations").update({
      status: "failed",
      error_message: `rawInput exceeds ${MAX_RAW_INPUT_BYTES} bytes (${rawInputBytes})`,
    }).eq("id", evaluationId);
    return;
  }

  try {
    // 1. Update status to processing
    await supabase.from("evaluations").update({ status: "processing" }).eq("id", evaluationId);

    // 2. Parse user submission — separate text descriptions from media items
    const attachmentDescriptions: string[] = [];
    const mediaItems: MediaItem[] = [];
    // Dedupe identical images across all attachments — docx frequently embeds the
    // same logo in header/footer of every section, and PDFs of slide decks often
    // render the same footer on every page.
    const imageHashes = new Set<string>();
    if (attachments && attachments.length > 0) {
      for (const path of attachments) {
        const filename = path.split("/").pop() ?? path;
        const ext = filename.split(".").pop()?.toLowerCase() ?? "";
        const isImage = /^(png|jpg|jpeg|gif|webp)$/.test(ext);
        const isVideo = /^(mp4|mov|avi|webm|mkv)$/.test(ext);
        const isZipDoc = /^(docx|pptx|xlsx)$/.test(ext);
        const isPdf = ext === "pdf";

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
        const buffer = Buffer.from(await data.arrayBuffer());

        if (isImage) {
          pushDedupedImage(mediaItems, imageHashes, mimeForExt(ext), buffer);
          attachmentDescriptions.push(`[Image attachment: ${filename}]`);
          continue;
        }

        if (isZipDoc) {
          // Text layer via officeparser, image layer via raw zip extraction.
          try {
            const ast = await OfficeParser.parseOffice(buffer);
            attachmentDescriptions.push(`[Document: ${filename}]\n${ast.toText().slice(0, 8000)}`);
          } catch (parseErr) {
            log.warn("orchestrator.attachment.parse_failed", {
              ...ctx, filename, error: parseErr instanceof Error ? parseErr.message : String(parseErr),
            });
            attachmentDescriptions.push(`[Document: ${filename} — could not extract text]`);
          }
          try {
            const zip = new AdmZip(buffer);
            let extracted = 0;
            for (const entry of zip.getEntries()) {
              if (entry.isDirectory) continue;
              if (!ARCHIVE_MEDIA_PREFIXES.some((p) => entry.entryName.startsWith(p))) continue;
              if (!ARCHIVE_IMAGE_RE.test(entry.entryName)) continue;
              const mediaExt = entry.entryName.split(".").pop() ?? "png";
              const entryData = entry.getData();
              if (!entryData) continue;
              if (pushDedupedImage(mediaItems, imageHashes, mimeForExt(mediaExt), entryData)) {
                extracted += 1;
              }
            }
            if (extracted > 0) {
              log.info("orchestrator.attachment.images_extracted", { ...ctx, filename, count: extracted, kind: ext });
            }
          } catch (zipErr) {
            log.warn("orchestrator.attachment.zip_failed", {
              ...ctx, filename, error: zipErr instanceof Error ? zipErr.message : String(zipErr),
            });
          }
          continue;
        }

        if (isPdf) {
          // Text layer via officeparser, visual layer via page rasterization so
          // diagrams/screenshots embedded in the PDF still reach the vision LLM.
          try {
            const ast = await OfficeParser.parseOffice(buffer);
            attachmentDescriptions.push(`[Document: ${filename}]\n${ast.toText().slice(0, 8000)}`);
          } catch (parseErr) {
            log.warn("orchestrator.attachment.parse_failed", {
              ...ctx, filename, error: parseErr instanceof Error ? parseErr.message : String(parseErr),
            });
            attachmentDescriptions.push(`[Document: ${filename} — could not extract text]`);
          }
          try {
            const pages = await pdfToPng(buffer, {
              outputFolder: undefined,
              viewportScale: 1.5,
              pagesToProcess: Array.from({ length: MAX_PDF_PAGES }, (_, i) => i + 1),
            });
            let extracted = 0;
            for (const page of pages) {
              if (!page.content) continue;
              if (pushDedupedImage(mediaItems, imageHashes, "image/png", page.content)) {
                extracted += 1;
              }
            }
            if (extracted > 0) {
              log.info("orchestrator.attachment.pdf_rasterized", { ...ctx, filename, pages: extracted });
            }
          } catch (pdfErr) {
            log.warn("orchestrator.attachment.pdf_rasterize_failed", {
              ...ctx, filename, error: pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
            });
          }
          continue;
        }

        // Plain text / markdown / csv / unknown — best-effort text read.
        try {
          const text = buffer.toString("utf8");
          attachmentDescriptions.push(`[Attachment: ${filename}]\n${text.slice(0, 5000)}`);
        } catch {
          attachmentDescriptions.push(`[Attachment: ${filename} — binary file]`);
        }
      }
    }

    // Use vision model when media attachments are present, text model otherwise
    const parseLlm = mediaItems.length > 0 ? buildVisionLLM(llmOverrides) : llm;
    const parseTask = parseProject(parseLlm, rawInput, url, attachmentDescriptions, mediaItems, mode);

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
        withTiming("orchestrator.classify_topic", ctx, () => classifyTopic(llm, rawInput, mode)),
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
      overall_stance?: import("../types/evaluation.js").PersonaStance | null;
      cited_references?: Array<{ claim: string; source?: string }> | null;
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

    const maxLike = planTier === "max" || planTier === "byok";
    const proLike = maxLike || planTier === "pro";

    const scenarioTask = maxLike
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

    const driftTask = proLike
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

    const debateTask = maxLike
      ? withTiming("orchestrator.round_table", ctx, () =>
          runRoundTableDebate(llm, personaList, reviews, parsedData, rawInput),
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
  } catch (error) {
    const err = error as { message?: unknown; stack?: unknown } | null | undefined;
    const errorMessage = typeof err?.message === "string" ? err.message : String(error);
    log.error("orchestrator.failed", {
      ...ctx,
      durationMs: Date.now() - startedAt,
      error: errorMessage,
      stack: typeof err?.stack === "string" ? err.stack : undefined,
    });
    await supabase
      .from("evaluations")
      .update({
        status: "failed",
        error_message: errorMessage.slice(0, 2000),
        failed_at: new Date().toISOString(),
      })
      .eq("id", evaluationId);
    throw error;
  }
}
