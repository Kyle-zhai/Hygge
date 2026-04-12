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
    .select("plan, custom_personas_limit")
    .eq("user_id", user.id)
    .single();

  const plan = subscription?.plan ?? "free";
  const planConfig = PLANS[plan as keyof typeof PLANS] ?? PLANS.free;

  if (!planConfig.features.customPersonas) {
    return NextResponse.json({ error: "Custom personas require a Pro or Max plan" }, { status: 403 });
  }

  const limit = subscription?.custom_personas_limit ?? planConfig.customPersonasLimit;
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

    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    let text = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("");

    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();

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
    console.error("Persona generation failed:", error?.message);
    return NextResponse.json({ error: "Failed to generate persona" }, { status: 500 });
  }
}
