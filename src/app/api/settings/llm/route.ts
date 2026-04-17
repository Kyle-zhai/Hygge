import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PROVIDER_TYPES = ["openai_compatible", "anthropic", "google"] as const;
type ProviderType = (typeof PROVIDER_TYPES)[number];

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return key.slice(0, 4) + "•".repeat(Math.min(16, key.length - 8)) + key.slice(-4);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_llm_settings")
    .select("provider_type, provider_label, base_url, model, vision_model, api_key, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return NextResponse.json({ settings: null });

  return NextResponse.json({
    settings: {
      provider_type: (data.provider_type ?? "openai_compatible") as ProviderType,
      provider_label: data.provider_label,
      base_url: data.base_url ?? "",
      model: data.model,
      vision_model: data.vision_model,
      api_key_masked: maskKey(data.api_key),
      updated_at: data.updated_at,
    },
  });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const providerType: ProviderType = PROVIDER_TYPES.includes(body.provider_type)
    ? body.provider_type
    : "openai_compatible";
  const providerLabel = typeof body.provider_label === "string" ? body.provider_label.trim() : null;
  const baseUrlRaw = typeof body.base_url === "string" ? body.base_url.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const visionModel = typeof body.vision_model === "string" && body.vision_model.trim()
    ? body.vision_model.trim()
    : null;
  const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : "";

  if (!model || !apiKey) {
    return NextResponse.json(
      { error: "model and api_key are required" },
      { status: 400 },
    );
  }
  if (providerType === "openai_compatible" && !baseUrlRaw) {
    return NextResponse.json(
      { error: "base_url is required for OpenAI-compatible providers" },
      { status: 400 },
    );
  }
  if (baseUrlRaw && !/^https?:\/\//.test(baseUrlRaw)) {
    return NextResponse.json({ error: "base_url must start with http(s)://" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_llm_settings")
    .upsert({
      user_id: user.id,
      provider_type: providerType,
      provider_label: providerLabel,
      base_url: baseUrlRaw || null,
      model,
      vision_model: visionModel,
      api_key: apiKey,
      updated_at: new Date().toISOString(),
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("user_llm_settings")
    .delete()
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
