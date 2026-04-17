import type { SupabaseClient } from "@supabase/supabase-js";
import { PLANS, type PlanFeatures } from "@/lib/stripe/plans";

export type EffectivePlanName = "free" | "pro" | "max" | "byok";

export interface SubscriptionLike {
  plan: string;
  evaluations_used: number;
  evaluations_limit: number;
}

export interface EffectivePlan {
  name: EffectivePlanName;
  isBYOK: boolean;
  maxPersonas: number;
  customPersonasLimit: number;
  features: PlanFeatures;
  evaluationsUsed: number;
  evaluationsLimit: number;
  skipQuota: boolean;
}

export function resolveEffectivePlan(
  subscription: SubscriptionLike,
  hasLLMOverrides: boolean,
): EffectivePlan | null {
  if (hasLLMOverrides) {
    const max = PLANS.max;
    return {
      name: "byok",
      isBYOK: true,
      maxPersonas: max.maxPersonas,
      customPersonasLimit: max.customPersonasLimit,
      features: max.features,
      evaluationsUsed: subscription.evaluations_used,
      evaluationsLimit: subscription.evaluations_limit,
      skipQuota: true,
    };
  }
  const cfg = PLANS[subscription.plan as keyof typeof PLANS];
  if (!cfg) return null;
  return {
    name: cfg.name as EffectivePlanName,
    isBYOK: false,
    maxPersonas: cfg.maxPersonas,
    customPersonasLimit: cfg.customPersonasLimit,
    features: cfg.features,
    evaluationsUsed: subscription.evaluations_used,
    evaluationsLimit: subscription.evaluations_limit,
    skipQuota: false,
  };
}

export async function fetchEffectivePlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<EffectivePlan | null> {
  const [{ data: subscription }, { data: llm }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan, evaluations_used, evaluations_limit")
      .eq("user_id", userId)
      .single(),
    supabase
      .from("user_llm_settings")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (!subscription) return null;
  return resolveEffectivePlan(subscription, !!llm);
}
