export type PlanTier = "free" | "pro" | "max";

export type ProviderType = "openai_compatible" | "anthropic" | "google";

// Minimum plan required to use each provider type. Higher plans include all
// providers available to lower plans.
export const PLAN_PROVIDER_TIER: Record<ProviderType, PlanTier> = {
  openai_compatible: "free",
  anthropic: "pro",
  google: "max",
};

const RANK: Record<PlanTier, number> = { free: 0, pro: 1, max: 2 };

export function planRank(plan: string | null | undefined): number {
  if (plan === "pro") return RANK.pro;
  if (plan === "max") return RANK.max;
  return RANK.free;
}

export function isProviderAllowedForPlan(
  provider: ProviderType,
  plan: string | null | undefined,
): boolean {
  return planRank(plan) >= RANK[PLAN_PROVIDER_TIER[provider]];
}
