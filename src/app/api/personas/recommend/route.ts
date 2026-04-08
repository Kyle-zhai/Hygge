import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectDescription } = await request.json();

  if (!projectDescription) {
    return NextResponse.json({ error: "projectDescription is required" }, { status: 400 });
  }

  const { data: personas } = await supabase.from("personas").select("*").eq("is_active", true);

  if (!personas?.length) {
    return NextResponse.json({ recommended_ids: [], reasoning: "No personas available" });
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });

    const personaList = personas.map((p: any) =>
      `- ID: ${p.id} | ${p.identity.name} | ${p.demographics.occupation} | Focus: ${p.evaluation_lens.primary_question}`
    ).join("\n");

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are a focus group coordinator. Given a project description and a list of available personas, recommend 5-8 of the most relevant personas.
Consider: target audience match, diverse perspectives, relevant expertise.
Respond ONLY with valid JSON: { "recommended_ids": ["id1", "id2", ...], "reasoning": "brief explanation" }`,
      messages: [{ role: "user", content: `Project: ${projectDescription}\n\nAvailable personas:\n${personaList}` }],
    });

    const text = response.content.filter((b) => b.type === "text").map((b) => "text" in b ? b.text : "").join("");
    return NextResponse.json(JSON.parse(text));
  } catch (error) {
    return NextResponse.json({
      recommended_ids: personas.slice(0, 5).map((p: any) => p.id),
      reasoning: "Default recommendation (LLM unavailable)",
    });
  }
}
