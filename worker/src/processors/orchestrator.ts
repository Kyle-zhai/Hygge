import type { Job } from "bullmq";
import { supabase } from "../supabase.js";
import { ClaudeLLM } from "../llm/claude.js";
import { OpenAICompatibleLLM } from "../llm/openai-compatible.js";
import { config } from "../config.js";
import { parseProject } from "./parse-project.js";
import { classifyTopic } from "./classify-topic.js";
import { generatePersonaReview } from "./persona-review.js";
import { generateSummaryReport, generateTopicSummaryReport } from "./summary-report.js";
import { runScenarioSimulation } from "./scenario-simulation.js";
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
  const llm = config.llm.provider === "openai-compatible"
    ? new OpenAICompatibleLLM(config.llm.apiKey, config.llm.model, config.llm.baseURL)
    : new ClaudeLLM(config.llm.apiKey, config.llm.model);

  try {
    // 1. Update status to processing
    await supabase.from("evaluations").update({ status: "processing" }).eq("id", evaluationId);

    // 2. Parse user submission
    let attachmentDescriptions: string[] = [];
    if (attachments && attachments.length > 0) {
      for (const path of attachments) {
        const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(path);
        if (isImage) {
          attachmentDescriptions.push(`[Image attachment: ${path.split("/").pop()}]`);
        } else {
          const { data } = await supabase.storage.from("attachments").download(path);
          if (data) {
            const text = await data.text();
            attachmentDescriptions.push(`[PDF attachment: ${path.split("/").pop()}]\n${text.slice(0, 5000)}`);
          }
        }
      }
    }

    const parsedData = await parseProject(llm, rawInput, url, attachmentDescriptions);
    await supabase.from("projects").update({ parsed_data: parsedData }).eq("id", projectId);

    // 3. Topic mode: classify topic and generate dynamic dimensions
    let dimensions: TopicClassification["dimensions"] | undefined;

    if (mode === "topic") {
      console.log(`[${evaluationId}] Topic mode — classifying topic...`);
      const classification = await classifyTopic(llm, rawInput);
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

    // 6. Generate discussion summary report
    console.log(`[${evaluationId}] Generating summary report...`);
    const summaryReport = mode === "topic" && dimensions
      ? await generateTopicSummaryReport(llm, parsedData, reviews, rawInput, dimensions)
      : await generateSummaryReport(llm, parsedData, reviews, rawInput, dimensions);
    console.log(`[${evaluationId}] Summary report generated`);

    // 7. Run social dynamics scenario simulation (Max plan only, product mode only)
    if (planTier === "max" && mode === "product") {
      console.log(`[${evaluationId}] Running scenario simulation...`);
      try {
        const simulation = await runScenarioSimulation(llm, personas as Persona[], reviews);
        summaryReport.scenario_simulation = simulation;
        console.log(`[${evaluationId}] Scenario simulation done`);
      } catch (simError) {
        console.error(`[${evaluationId}] Scenario simulation failed, skipping:`, simError);
        summaryReport.scenario_simulation = null;
      }
    }

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
