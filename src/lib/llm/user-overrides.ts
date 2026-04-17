import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export type LLMProviderType = "openai_compatible" | "anthropic" | "google";

export interface LLMOverrides {
  providerType: LLMProviderType;
  apiKey: string;
  baseURL?: string;
  model: string;
  visionModel?: string;
}

export async function fetchUserLLMOverrides(userId: string): Promise<LLMOverrides | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  const admin = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data } = await admin
    .from("user_llm_settings")
    .select("api_key, base_url, model, vision_model, provider_type")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;

  const providerType = (data.provider_type as LLMProviderType | null) ?? "openai_compatible";
  return {
    providerType,
    apiKey: data.api_key,
    baseURL: data.base_url || undefined,
    model: data.model,
    visionModel: data.vision_model ?? undefined,
  };
}
