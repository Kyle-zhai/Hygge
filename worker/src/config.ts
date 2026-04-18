import "dotenv/config";

const fallbackModels = (process.env.LLM_FALLBACK_MODELS ?? "qwen3.6-plus,qwen3-32b,qwen3.6-flash")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const config = {
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  llm: {
    apiKey: process.env.LLM_API_KEY || "",
    model: process.env.LLM_MODEL || "glm-5",
    visionModel: process.env.LLM_VISION_MODEL || "qwen3.5-omni-plus",
    baseURL: process.env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
    fallbackModels,
    // Hard cap on a single LLM HTTP call. Node fetch has no default timeout,
    // so without this a slow/hung provider (Qwen sometimes stalls >2 min on
    // JSON-mode completions) leaves the worker spinning on "thinking" forever.
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 120_000),
  },
  supabase: {
    url: process.env.SUPABASE_URL || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },
} as const;
