import "dotenv/config";

export const config = {
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  llm: {
    apiKey: process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY || "",
    model: process.env.LLM_MODEL || "qwen-max",
    baseURL: process.env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
    provider: process.env.LLM_PROVIDER || "openai-compatible",
  },
  supabase: {
    url: process.env.SUPABASE_URL || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },
} as const;
