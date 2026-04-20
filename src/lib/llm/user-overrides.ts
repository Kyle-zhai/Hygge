import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { decryptLLMKey } from "@/lib/crypto/llm-key";

export type LLMProviderType = "openai_compatible" | "anthropic" | "google";

export interface LLMOverrideEntry {
  providerType: LLMProviderType;
  apiKey: string;
  baseURL?: string;
  model: string;
  visionModel?: string;
  label?: string;
}

export type LLMOverrides = LLMOverrideEntry[];

export async function fetchUserLLMOverrides(userId: string): Promise<LLMOverrides | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  const admin = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data } = await admin
    .from("user_llm_chain_entries")
    .select("provider_type, label, base_url, model, vision_model, api_key, order_index")
    .eq("user_id", userId)
    .eq("enabled", true)
    .order("order_index", { ascending: true });

  if (!data || data.length === 0) return null;

  const entries: LLMOverrideEntry[] = [];
  for (const row of data) {
    let apiKey: string;
    try {
      apiKey = decryptLLMKey(row.api_key);
    } catch (err) {
      console.error("llm.key_decrypt_failed", {
        userId,
        orderIndex: row.order_index,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    entries.push({
      providerType: (row.provider_type as LLMProviderType | null) ?? "openai_compatible",
      apiKey,
      baseURL: row.base_url || undefined,
      model: row.model,
      visionModel: row.vision_model ?? undefined,
      label: row.label ?? undefined,
    });
  }
  return entries.length > 0 ? entries : null;
}
