import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptLLMKey, encryptLLMKey } from "@/lib/crypto/llm-key";
import { enforceRateLimit } from "@/lib/rate-limit";

const PROVIDER_TYPES = ["openai_compatible", "anthropic", "google"] as const;
type ProviderType = (typeof PROVIDER_TYPES)[number];

const MAX_CHAIN_LEN = 10;

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return key.slice(0, 4) + "•".repeat(Math.min(16, key.length - 8)) + key.slice(-4);
}

interface EntryInput {
  id?: string;
  provider_type?: string;
  label?: string | null;
  base_url?: string | null;
  model?: string;
  vision_model?: string | null;
  api_key?: string;
  keep_existing_key?: boolean;
  enabled?: boolean;
}

interface NormalizedEntry {
  provider_type: ProviderType;
  label: string | null;
  base_url: string | null;
  model: string;
  vision_model: string | null;
  api_key: string;
  enabled: boolean;
}

function normalizeEntry(raw: EntryInput): NormalizedEntry | { error: string } {
  const providerType: ProviderType = PROVIDER_TYPES.includes(raw.provider_type as ProviderType)
    ? (raw.provider_type as ProviderType)
    : "openai_compatible";
  const model = typeof raw.model === "string" ? raw.model.trim() : "";
  const apiKey = typeof raw.api_key === "string" ? raw.api_key.trim() : "";
  const baseUrl = typeof raw.base_url === "string" ? raw.base_url.trim() : "";
  if (!model) return { error: "model is required" };
  if (!apiKey) return { error: "api_key is required" };
  if (providerType === "openai_compatible" && !baseUrl) {
    return { error: "base_url is required for OpenAI-compatible providers" };
  }
  if (baseUrl && !/^https?:\/\//.test(baseUrl)) {
    return { error: "base_url must start with http(s)://" };
  }
  const visionModel = typeof raw.vision_model === "string" && raw.vision_model.trim()
    ? raw.vision_model.trim()
    : null;
  const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : null;
  const enabled = raw.enabled === false ? false : true;
  return {
    provider_type: providerType,
    label,
    base_url: baseUrl || null,
    model,
    vision_model: visionModel,
    api_key: apiKey,
    enabled,
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_llm_chain_entries")
    .select("id, provider_type, label, base_url, model, vision_model, api_key, order_index, updated_at, enabled")
    .eq("user_id", user.id)
    .order("order_index", { ascending: true });

  const entries = (data ?? []).map((row) => {
    let plainKey = "";
    try {
      plainKey = decryptLLMKey(row.api_key);
    } catch {
      plainKey = row.api_key;
    }
    return {
      id: row.id as string,
      provider_type: (row.provider_type ?? "openai_compatible") as ProviderType,
      label: row.label,
      base_url: row.base_url ?? "",
      model: row.model,
      vision_model: row.vision_model,
      api_key_masked: maskKey(plainKey),
      order_index: row.order_index,
      updated_at: row.updated_at,
      enabled: row.enabled !== false,
    };
  });

  return NextResponse.json({ entries });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitResponse = await enforceRateLimit("llmSettings", user.id);
  if (limitResponse) return limitResponse;

  const body = await request.json().catch(() => ({}));
  const rawEntries: EntryInput[] = Array.isArray(body?.entries) ? body.entries : [];
  if (rawEntries.length === 0) {
    return NextResponse.json({ error: "entries must be a non-empty array" }, { status: 400 });
  }
  if (rawEntries.length > MAX_CHAIN_LEN) {
    return NextResponse.json({ error: `Maximum ${MAX_CHAIN_LEN} entries per chain` }, { status: 400 });
  }

  // keep_existing_key=true reuses the ciphertext of the row identified by `id`,
  // letting users reorder or edit other fields without retyping every key.
  const { data: existing } = await supabase
    .from("user_llm_chain_entries")
    .select("id, api_key")
    .eq("user_id", user.id);
  const keyById = new Map<string, string>();
  for (const row of existing ?? []) keyById.set(row.id as string, row.api_key as string);

  const normalized: NormalizedEntry[] = [];
  for (let i = 0; i < rawEntries.length; i++) {
    const raw = rawEntries[i];
    const reuseKey = raw.keep_existing_key === true;
    if (reuseKey) {
      const existingId = typeof raw.id === "string" ? raw.id : "";
      if (!existingId) {
        return NextResponse.json(
          { error: `entry ${i}: keep_existing_key=true requires id` },
          { status: 400 },
        );
      }
      const existingCipher = keyById.get(existingId);
      if (!existingCipher) {
        return NextResponse.json(
          { error: `entry ${i}: no existing entry with id=${existingId}` },
          { status: 400 },
        );
      }
      const prepared = { ...raw, api_key: "__reuse__" };
      const n = normalizeEntry(prepared);
      if ("error" in n) {
        return NextResponse.json({ error: `entry ${i}: ${n.error}` }, { status: 400 });
      }
      normalized.push({ ...n, api_key: existingCipher });
    } else {
      const n = normalizeEntry(raw);
      if ("error" in n) {
        return NextResponse.json({ error: `entry ${i}: ${n.error}` }, { status: 400 });
      }
      try {
        n.api_key = encryptLLMKey(n.api_key);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "encryption_unavailable" },
          { status: 500 },
        );
      }
      normalized.push(n);
    }
  }

  // Full replace: wipe then insert the new chain. One transaction would be cleaner
  // but Supabase JS client doesn't expose txns; delete-then-insert is acceptable
  // because RLS scopes to user_id and the window is milliseconds.
  const { error: delErr } = await supabase
    .from("user_llm_chain_entries")
    .delete()
    .eq("user_id", user.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  const rows = normalized.map((n, i) => ({
    user_id: user.id,
    order_index: i,
    provider_type: n.provider_type,
    label: n.label,
    base_url: n.base_url,
    model: n.model,
    vision_model: n.vision_model,
    api_key: n.api_key,
    enabled: n.enabled,
    updated_at: new Date().toISOString(),
  }));
  const { error: insErr } = await supabase.from("user_llm_chain_entries").insert(rows);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, count: rows.length });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("user_llm_chain_entries")
    .delete()
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
