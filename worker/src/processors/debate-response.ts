import type { Job } from "bullmq";
import { supabase } from "../supabase.js";
import { buildLLM, type LLMOverrides } from "../llm/factory.js";

export interface DebateResponseJobData {
  debateId: string;
  userMessageId: string;
  llmOverrides?: LLMOverrides;
}

export async function processDebateResponse(job: Job<DebateResponseJobData>) {
  const { debateId, userMessageId, llmOverrides } = job.data;
  const llm = buildLLM(llmOverrides);

  const { data: debate } = await supabase
    .from("debates")
    .select("id, evaluation_id, persona_id, title")
    .eq("id", debateId)
    .single();

  if (!debate) throw new Error(`Debate ${debateId} not found`);

  const { data: persona } = await supabase
    .from("personas")
    .select("*")
    .eq("id", debate.persona_id)
    .single();

  if (!persona) throw new Error(`Persona ${debate.persona_id} not found`);

  const { data: evaluation } = await supabase
    .from("evaluations")
    .select("topic_classification, mode")
    .eq("id", debate.evaluation_id)
    .single();

  const { data: review } = await supabase
    .from("persona_reviews")
    .select("review_text, strengths, weaknesses, overall_stance")
    .eq("evaluation_id", debate.evaluation_id)
    .eq("persona_id", debate.persona_id)
    .single();

  const { data: messages } = await supabase
    .from("debate_messages")
    .select("role, content")
    .eq("debate_id", debateId)
    .order("created_at", { ascending: true });

  const history = (messages || []).map((m) => ({
    role: m.role === "user" ? "user" as const : "assistant" as const,
    content: m.content,
  }));

  const system = `You are ${persona.identity.name}, ${persona.demographics.occupation}.
${persona.system_prompt || ""}

You are in a 1-on-1 debate with a user about a topic you previously evaluated. Stay completely in character — use your personality, biases, communication style, and values. You may be persuaded by strong arguments, but don't concede easily.

Your original evaluation:
${review?.review_text || "No review available."}
${review?.overall_stance ? `Your stance: ${review.overall_stance}` : ""}
${review?.strengths?.length ? `Strengths you identified: ${review.strengths.join("; ")}` : ""}
${review?.weaknesses?.length ? `Weaknesses you identified: ${review.weaknesses.join("; ")}` : ""}

Respond naturally in 2-5 sentences. Be specific, not generic. If the user makes a compelling point, acknowledge it while maintaining your character's perspective. Respond in the same language the user writes in.`;

  const conversationPrompt = history.map((m) =>
    `${m.role === "user" ? "User" : persona.identity.name}: ${m.content}`
  ).join("\n\n");

  const response = await llm.complete({
    system,
    prompt: conversationPrompt || "Start the conversation.",
    maxTokens: 512,
  });

  await supabase.from("debate_messages").insert({
    debate_id: debateId,
    role: "persona",
    content: response.text.trim(),
  });

  if (!debate.title && messages && messages.length <= 2) {
    const userMsg = messages.find((m) => m.role === "user");
    if (userMsg) {
      const title = userMsg.content.slice(0, 60) + (userMsg.content.length > 60 ? "..." : "");
      await supabase.from("debates").update({ title, updated_at: new Date().toISOString() }).eq("id", debateId);
    }
  } else {
    await supabase.from("debates").update({ updated_at: new Date().toISOString() }).eq("id", debateId);
  }

  return { success: true, debateId };
}
