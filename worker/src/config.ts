import "dotenv/config";

export type ProviderType = "openai_compatible" | "anthropic" | "google";

export interface ChainEntry {
  providerType: ProviderType;
  apiKey: string;
  baseURL?: string;
  model: string;
  visionModel?: string;
  label?: string;
}

const MAX_CHAIN_LEN = 10;
const PROVIDER_TYPES: ReadonlySet<string> = new Set([
  "openai_compatible",
  "anthropic",
  "google",
]);

function normalizeProvider(raw: string | undefined): ProviderType {
  const v = (raw || "openai_compatible").trim().replace(/-/g, "_").toLowerCase();
  return (PROVIDER_TYPES.has(v) ? v : "openai_compatible") as ProviderType;
}

function readChainFromEnv(): ChainEntry[] {
  const entries: ChainEntry[] = [];
  for (let i = 1; i <= MAX_CHAIN_LEN; i++) {
    const apiKey = process.env[`LLM_${i}_API_KEY`]?.trim();
    const model = process.env[`LLM_${i}_MODEL`]?.trim();
    if (!apiKey || !model) continue;
    const providerType = normalizeProvider(process.env[`LLM_${i}_PROVIDER`]);
    const baseURL = process.env[`LLM_${i}_BASE_URL`]?.trim() || undefined;
    const visionModel = process.env[`LLM_${i}_VISION_MODEL`]?.trim() || undefined;
    const label = process.env[`LLM_${i}_LABEL`]?.trim() || undefined;
    if (providerType === "openai_compatible" && !baseURL) {
      // openai_compatible requires a baseURL; skip malformed entries rather than crash
      continue;
    }
    entries.push({ providerType, apiKey, baseURL, model, visionModel, label });
  }

  if (entries.length > 0) return entries;

  // Backwards-compat fallback: fold legacy LLM_MODEL / LLM_BASE_URL / LLM_API_KEY /
  // LLM_FALLBACK_MODELS into a single openai_compatible chain. This path stays alive
  // for local development until Railway is migrated to LLM_N_*.
  const legacyKey = process.env.LLM_API_KEY?.trim();
  const legacyModel = process.env.LLM_MODEL?.trim();
  const legacyBase = process.env.LLM_BASE_URL?.trim();
  if (!legacyKey || !legacyModel || !legacyBase) return [];
  const legacyVision = process.env.LLM_VISION_MODEL?.trim() || undefined;
  const models = [
    legacyModel,
    ...(process.env.LLM_FALLBACK_MODELS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];
  return models.map((model) => ({
    providerType: "openai_compatible" as ProviderType,
    apiKey: legacyKey,
    baseURL: legacyBase,
    model,
    visionModel: legacyVision,
    label: "legacy",
  }));
}

const chain = readChainFromEnv();

export const config = {
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  llm: {
    chain,
    // Hard cap on a single LLM HTTP call. Node fetch has no default timeout,
    // so without this a slow/hung provider leaves the worker stuck on "thinking"
    // until BullMQ's lockDuration rolls over (long after the user gave up).
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 120_000),
  },
  supabase: {
    url: process.env.SUPABASE_URL || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },
} as const;
