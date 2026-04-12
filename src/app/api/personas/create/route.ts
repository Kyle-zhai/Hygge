import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/stripe/plans";
import { buildGeneratePersonaPrompt } from "@/lib/prompts/generate-persona";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .single();

  const plan = subscription?.plan ?? "free";
  const planConfig = PLANS[plan as keyof typeof PLANS] ?? PLANS.free;

  if (!planConfig.features.customPersonas) {
    return NextResponse.json({ error: "Custom personas require a Pro or Max plan" }, { status: 403 });
  }

  const limit = planConfig.customPersonasLimit;
  if (limit !== -1) {
    const { count } = await supabase
      .from("personas")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .eq("is_custom", true);

    if ((count ?? 0) >= limit) {
      return NextResponse.json({
        error: `Custom persona limit reached (${limit}). Upgrade to Max for unlimited.`,
      }, { status: 429 });
    }
  }

  const body = await request.json();
  const { name, occupation, personality, background, importedText } = body;

  if (!name || !occupation || !personality) {
    return NextResponse.json({ error: "name, occupation, and personality are required" }, { status: 400 });
  }

  try {
    const { system, prompt } = buildGeneratePersonaPrompt({
      name,
      occupation,
      personality,
      background,
      importedText,
    });

    const baseURL = process.env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
    const apiKey = process.env.LLM_API_KEY || "";
    const model = process.env.LLM_MODEL || "qwen-max";

    const llmResponse = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!llmResponse.ok) {
      const err = await llmResponse.text();
      console.error("LLM API error:", llmResponse.status, "model:", model, "baseURL:", baseURL, err);
      throw new Error(`LLM API error (${llmResponse.status}), model=${model}: ${err.slice(0, 200)}`);
    }

    const llmData = await llmResponse.json();
    let text = llmData.choices?.[0]?.message?.content ?? "";

    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();

    text = text.replace(/[\x00-\x1F\x7F]/g, (ch: string) => {
      if (ch === "\n" || ch === "\r" || ch === "\t") return " ";
      return "";
    });

    const persona = JSON.parse(text);

    const { data: inserted, error: insertError } = await supabase
      .from("personas")
      .insert({
        identity: persona.identity,
        demographics: persona.demographics,
        social_context: persona.social_context,
        financial_profile: persona.financial_profile,
        psychology: persona.psychology,
        behaviors: persona.behaviors,
        evaluation_lens: persona.evaluation_lens,
        life_narrative: persona.life_narrative,
        internal_conflicts: persona.internal_conflicts,
        contextual_behaviors: persona.contextual_behaviors,
        latent_needs: persona.latent_needs,
        system_prompt: persona.system_prompt,
        category: "custom",
        is_active: true,
        creator_id: user.id,
        is_custom: true,
        is_public: false,
        source: importedText ? "imported" : "manual",
        description: persona.description ?? null,
        tags: persona.tags ?? [],
      })
      .select("id, identity, demographics, evaluation_lens, category, description, tags")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ persona: inserted }, { status: 201 });
  } catch (error: any) {
    console.error("Persona generation failed:", error?.message, error?.stack);
    return NextResponse.json({ error: error?.message || "Failed to generate persona" }, { status: 500 });
  }
}
