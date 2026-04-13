import type { Job } from "bullmq";
import { OfficeParser } from "officeparser";
import { supabase } from "../supabase.js";
import { OpenAICompatibleLLM } from "../llm/openai-compatible.js";
import type { MediaItem } from "../llm/adapter.js";
import { config } from "../config.js";
import { parseProject } from "./parse-project.js";
import { classifyTopic } from "./classify-topic.js";
import { generatePersonaReview } from "./persona-review.js";
import { generateSummaryReport, generateTopicSummaryReport } from "./summary-report.js";
import { runScenarioSimulation } from "./scenario-simulation.js";
import { generateOpinionDrift } from "./opinion-drift.js";
import type { Persona } from "../types/persona.js";
import type { TopicClassification } from "../types/evaluation.js";

interface EvaluationJobData {
  evaluationId: string;
  projectId: string;
  rawInput: string;
  url?: string;
  attachments?: string[];
  selectedPersonaIds: string[];
  planTier: "free" | "pro" | "max";
  mode: "product" | "topic";
}

export async function processEvaluation(job: Job<EvaluationJobData>) {
  const { evaluationId, projectId, rawInput, url, attachments, selectedPersonaIds, planTier, mode } = job.data;
  const llm = new OpenAICompatibleLLM(config.llm.apiKey, config.llm.model, config.llm.baseURL);

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
            console.error(`[${evaluationId}] Failed to parse ${filename}:`, parseErr);
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
    const parseLlm = mediaItems.length > 0
      ? new OpenAICompatibleLLM(config.llm.apiKey, config.llm.visionModel, config.llm.baseURL)
      : llm;
    const parseTask = parseProject(parseLlm, rawInput, url, attachmentDescriptions, mediaItems);
    const classifyTask = mode === "topic" ? classifyTopic(llm, rawInput) : Promise.resolve(null);
    const [parsedData, classification] = await Promise.all([parseTask, classifyTask]);

    await supabase.from("projects").update({ parsed_data: parsedData }).eq("id", projectId);

    let dimensions: TopicClassification["dimensions"] | undefined;
    if (classification) {
      dimensions = classification.dimensions;
      console.log(`[${evaluationId}] Topic type: ${classification.topic_type}, dimensions: ${dimensions.map(d => d.key).join(", ")}`);
      await supabase.from("evaluations").update({ topic_classification: classification }).eq("id", evaluationId);
    }

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
    const CONCURRENCY = 3;
    const personaList = personas as Persona[];

    for (let i = 0; i < personaList.length; i += CONCURRENCY) {
      const batch = personaList.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (persona) => {
          const review = await generatePersonaReview(llm, persona, parsedData, rawInput, dimensions);

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
    }

    // 6. Summary report, scenario sim, and opinion drift all depend on reviews
    //    but are independent of each other — run them in parallel.
    console.log(`[${evaluationId}] Running summary + sim + drift in parallel...`);
    const summaryTask = mode === "topic" && dimensions
      ? generateTopicSummaryReport(llm, parsedData, reviews, rawInput, dimensions)
      : generateSummaryReport(llm, parsedData, reviews, rawInput, dimensions);

    const scenarioTask = planTier === "max"
      ? runScenarioSimulation(llm, personas as Persona[], reviews).catch((simError) => {
          console.error(`[${evaluationId}] Scenario simulation failed, skipping:`, simError);
          return null;
        })
      : Promise.resolve(null);

    const driftTask = planTier === "pro" || planTier === "max"
      ? generateOpinionDrift(llm, personas as Persona[], reviews).catch((driftError) => {
          console.error(`[${evaluationId}] Opinion drift failed, skipping:`, driftError);
          return null;
        })
      : Promise.resolve(null);

    const [summaryReport, simulation, drift] = await Promise.all([summaryTask, scenarioTask, driftTask]);
    summaryReport.scenario_simulation = simulation;
    summaryReport.opinion_drift = drift && drift.length > 0 ? drift : null;
    console.log(`[${evaluationId}] Summary + sim + drift complete (${drift?.length ?? 0} drift entries)`);

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
    return { success: true, evaluationId };
  } catch (error: any) {
    console.error(`[${evaluationId}] EVALUATION FAILED:`, error?.message || error);
    console.error(`[${evaluationId}] Stack:`, error?.stack);
    await supabase.from("evaluations").update({ status: "failed" }).eq("id", evaluationId);
    throw error;
  }
}
