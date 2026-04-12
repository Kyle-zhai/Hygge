import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectDescription, mode } = await request.json();

  if (!projectDescription) {
    return NextResponse.json({ error: "projectDescription is required" }, { status: 400 });
  }

  const validCategories = mode === "topic"
    ? ["general"]
    : ["technical", "product", "design", "end_user", "business"];

  const { data: personas } = await supabase
    .from("personas")
    .select("*")
    .eq("is_active", true)
    .in("category", validCategories);

  if (!personas?.length) {
    return NextResponse.json({ recommended_ids: [], reasoning: "No personas available" });
  }

  try {
    const baseURL = process.env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
    const apiKey = process.env.LLM_API_KEY || "";
    const model = process.env.LLM_MODEL || "qwen-max";

    const personaList = personas.map((p: any) =>
      `- ID: ${p.id} | ${p.identity.name} | ${p.demographics.occupation} | Focus: ${p.evaluation_lens.primary_question}`
    ).join("\n");

    const llmResponse = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          { role: "system", content: `You are a focus group coordinator. Given a project description and a list of available personas, recommend 5-8 of the most relevant personas.\nConsider: target audience match, diverse perspectives, relevant expertise.\nRespond ONLY with valid JSON: { "recommended_ids": ["id1", "id2", ...], "reasoning": "brief explanation" }` },
          { role: "user", content: `Project: ${projectDescription}\n\nAvailable personas:\n${personaList}` },
        ],
      }),
    });

    if (!llmResponse.ok) throw new Error(`LLM error ${llmResponse.status}`);
    const data = await llmResponse.json();
    let text = data.choices?.[0]?.message?.content ?? "";
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();
    return NextResponse.json(JSON.parse(text));
  } catch (error) {
    return NextResponse.json({
      recommended_ids: personas.slice(0, 5).map((p: any) => p.id),
      reasoning: "Default recommendation (LLM unavailable)",
    });
  }
}
