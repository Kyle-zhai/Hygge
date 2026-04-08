import type { Job } from "bullmq";
import { supabase } from "../supabase.js";
import { ClaudeLLM } from "../llm/claude.js";
import { config } from "../config.js";
import { parseProject } from "./parse-project.js";
import { generatePersonaReview } from "./persona-review.js";
import { generateSummaryReport } from "./summary-report.js";
import { runScenarioSimulation } from "./scenario-simulation.js";
import type { Persona } from "@shared/types/persona.js";

interface EvaluationJobData {
  evaluationId: string;
  projectId: string;
  rawInput: string;
  url?: string;
  selectedPersonaIds: string[];
  planTier: "free" | "pro" | "max";
}

export async function processEvaluation(job: Job<EvaluationJobData>) {
  const { evaluationId, projectId, rawInput, url, selectedPersonaIds, planTier } = job.data;
  const llm = new ClaudeLLM(config.anthropic.apiKey, config.anthropic.model);

  try {
    // 1. Update status to processing
    await supabase.from("evaluations").update({ status: "processing" }).eq("id", evaluationId);

    // 2. Parse project input
    const parsedData = await parseProject(llm, rawInput, url);
    await supabase.from("projects").update({ parsed_data: parsedData }).eq("id", projectId);

    // 3. Fetch selected personas
    const { data: personas } = await supabase.from("personas").select("*").in("id", selectedPersonaIds);
    if (!personas || personas.length === 0) {
      throw new Error("No personas found for selected IDs");
    }

    // 4. Generate individual persona reviews (sequentially)
    const reviews: Array<{
      persona_id: string;
      persona_name: string;
      scores: import("@shared/types/evaluation.js").EvaluationScores;
      review_text: string;
      strengths: string[];
      weaknesses: string[];
      llm_model: string;
    }> = [];

    for (const persona of personas as Persona[]) {
      const review = await generatePersonaReview(llm, persona, parsedData, rawInput);

      // Write review to DB immediately (for realtime updates)
      await supabase.from("persona_reviews").insert({
        evaluation_id: evaluationId,
        persona_id: persona.id,
        scores: review.scores,
        review_text: review.review_text,
        strengths: review.strengths,
        weaknesses: review.weaknesses,
        llm_model: review.llm_model,
      });

      reviews.push({
        persona_id: persona.id,
        persona_name: persona.identity.name,
        ...review,
      });

      await job.updateProgress(Math.round((reviews.length / personas.length) * 80));
    }

    // 5. Generate summary report
    const summaryReport = await generateSummaryReport(llm, parsedData, reviews, rawInput);

    // 6. Run scenario simulation (Max plan only)
    if (planTier === "max") {
      const simulation = await runScenarioSimulation(llm, personas as Persona[], reviews);
      summaryReport.scenario_simulation = simulation;
    }

    await job.updateProgress(95);

    // 7. Write summary report to DB
    await supabase.from("summary_reports").insert({
      evaluation_id: evaluationId,
      ...summaryReport,
    });

    // 8. Mark evaluation as completed
    await supabase.from("evaluations").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", evaluationId);

    await job.updateProgress(100);
    return { success: true, evaluationId };
  } catch (error) {
    await supabase.from("evaluations").update({ status: "failed" }).eq("id", evaluationId);
    throw error;
  }
}
