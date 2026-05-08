import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

type LimiterKey =
  | "evaluations"
  | "personas"
  | "debateMessages"
  | "llmSettings"
  | "feedback"
  | "decisionMessages"
  | "decisionRerun";

const CONFIGS: Record<LimiterKey, { limit: number; window: `${number} ${"s" | "m" | "h"}` }> = {
  evaluations: { limit: 20, window: "1 h" },
  personas: { limit: 30, window: "1 h" },
  debateMessages: { limit: 120, window: "1 h" },
  llmSettings: { limit: 10, window: "15 m" },
  feedback: { limit: 60, window: "1 m" },
  // 60/min covers fast-typed clarification answers without throttling normal use,
  // but caps an LLM-token-budget drainer at ~3600 LLM calls/hour per user.
  decisionMessages: { limit: 60, window: "1 m" },
  // /rerun is heavier (creates a child brief + enqueues full orchestrator);
  // 10/h is generous for a human iterating on conditions.
  decisionRerun: { limit: 10, window: "1 h" },
};

let cachedRedis: Redis | null | undefined;
const cachedLimiters: Partial<Record<LimiterKey, Ratelimit>> = {};

function getRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    cachedRedis = null;
    return null;
  }
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

function getLimiter(key: LimiterKey): Ratelimit | null {
  if (cachedLimiters[key]) return cachedLimiters[key]!;
  const redis = getRedis();
  if (!redis) return null;
  const { limit, window } = CONFIGS[key];
  cachedLimiters[key] = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `hygge:rl:${key}`,
    analytics: false,
  });
  return cachedLimiters[key]!;
}

export async function enforceRateLimit(
  key: LimiterKey,
  identifier: string,
): Promise<NextResponse | null> {
  const limiter = getLimiter(key);
  if (!limiter) return null;

  const { success, limit, remaining, reset } = await limiter.limit(identifier);
  if (success) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: "Rate limit exceeded. Please try again later.",
      limit,
      remaining,
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(Math.floor(reset / 1000)),
      },
    },
  );
}
