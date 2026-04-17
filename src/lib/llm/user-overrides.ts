import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export interface LLMOverrides {
  apiKey: string;
  baseURL: string;
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
    .select("api_key, base_url, model, vision_model")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;
  return {
    apiKey: data.api_key,
    baseURL: data.base_url,
    model: data.model,
    visionModel: data.vision_model ?? undefined,
  };
}
