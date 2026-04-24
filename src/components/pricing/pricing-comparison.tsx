"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Sparkles } from "lucide-react";

interface PricingComparisonProps {
  currentPlan: string;
}

const PLAN_ORDER = ["free", "pro", "max"] as const;

export function PricingComparison({ currentPlan }: PricingComparisonProps) {
  const t = useTranslations("pricing");
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const currentIndex = PLAN_ORDER.indexOf(currentPlan as (typeof PLAN_ORDER)[number]);

  async function handleAction(planKey: string) {
    if (planKey === "free" || planKey === currentPlan) return;
    setLoadingPlan(planKey);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (data.url) router.push(data.url);
    } catch {
      setLoadingPlan(null);
    }
  }

  // Feature definitions: each plan's features stack upward
  // Free = base, Pro = base + new, Max = base + pro + new
  // Each tier shows ALL its features. Higher tiers visually have more rows.
  // "extras" are features NEW in this tier (highlighted in gold).
  const plans = [
    {
      key: "free",
      name: t("free"),
      price: "$0",
      base: [
        t("feat_discussions_free"),
        t("feat_personas_free"),
        t("feat_brief_report"),
      ],
      extras: [] as string[],
    },
    {
      key: "pro",
      name: t("pro"),
      price: "$20",
      isPopular: true,
      base: [
        t("feat_discussions_pro"),
        t("feat_personas_pro"),
      ],
      extras: [
        t("feat_full_report"),
        t("feat_opinion_drift"),
        t("feat_custom_personas"),
        t("feat_marketplace"),
        t("feat_export"),
        t("feat_compare"),
      ],
    },
    {
      key: "max",
      name: t("max"),
      price: "$50",
      base: [
        t("feat_discussions_max"),
        t("feat_personas_max"),
        t("feat_full_report"),
        t("feat_opinion_drift"),
        t("feat_export"),
        t("feat_compare"),
        t("feat_marketplace"),
      ],
      extras: [
        t("feat_custom_personas_unlimited"),
        t("feat_scenario_sim"),
        t("feat_round_table"),
        t("feat_1v1_debate"),
        t("feat_marketplace_featured"),
      ],
    },
  ];

  function getButtonState(planKey: string) {
    const planIndex = PLAN_ORDER.indexOf(planKey as (typeof PLAN_ORDER)[number]);
    if (planKey === currentPlan) return "current";
    if (planIndex > currentIndex) return "upgrade";
    if (planIndex < currentIndex) return "downgrade";
    return "upgrade";
  }

  return (
    <div className="grid items-start gap-5 md:grid-cols-3">
      {plans.map((plan) => {
        const state = getButtonState(plan.key);
        const isLoading = loadingPlan === plan.key;

        return (
          <div
            key={plan.key}
            className={`relative flex flex-col rounded-2xl border transition-all duration-300 ${
              plan.isPopular
                ? "border-[rgb(var(--accent-primary-rgb)/0.60)] bg-[color:var(--bg-secondary)] shadow-[0_0_40px_-12px_rgba(226,221,213,0.12)]"
                : "border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] hover:border-[color:var(--border-hover)]"
            }`}
          >
            {/* Popular badge */}
            {plan.isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="border-0 bg-[color:var(--accent-primary)] px-3 py-1 text-xs font-semibold text-[color:var(--bg-primary)]">
                  <Sparkles className="mr-1 h-3 w-3" />
                  {t("mostPopular")}
                </Badge>
              </div>
            )}

            {/* Header: name + price */}
            <div className="px-6 pt-8 pb-5 text-center border-b border-[rgb(var(--border-default-rgb)/0.50)]">
              <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{plan.name}</h3>
              <div className="mt-3 flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-[color:var(--text-primary)]">{plan.price}</span>
                {plan.price !== "$0" && (
                  <span className="text-sm text-[color:var(--text-tertiary)]">{t("perMonth")}</span>
                )}
              </div>
            </div>

            {/* Features — base features first, then extras highlighted */}
            <div className="flex-1 px-6 py-5">
              <ul className="space-y-3">
                {plan.base.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#4ADE80]" />
                    <span className="text-[color:var(--text-secondary)]">{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.extras.length > 0 && (
                <div className="mt-3 border-t border-[rgb(var(--accent-warm-rgb)/0.20)] pt-3">
                  <p className="mb-2.5 text-xs text-[color:var(--accent-warm)]">
                    {t("includedIn", { plan: plan.key === "max" ? t("pro") : t("free") })}
                  </p>
                  <ul className="space-y-3">
                    {plan.extras.map((extra, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent-warm)]" />
                        <span className="text-[color:var(--text-primary)] font-medium">{extra}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* CTA button */}
            <div className="px-6 pb-6">
              {state === "current" ? (
                <Button
                  variant="outline"
                  disabled
                  className="w-full border-[color:var(--border-default)] bg-transparent text-[color:var(--text-tertiary)]"
                >
                  {t("currentPlan")}
                </Button>
              ) : state === "upgrade" ? (
                <Button
                  className={`w-full font-semibold ${
                    plan.isPopular
                      ? "bg-[color:var(--accent-primary)] hover:bg-[color:var(--accent-primary-hover)] text-[color:var(--bg-primary)] btn-glow"
                      : "bg-[color:var(--bg-tertiary)] text-[color:var(--text-primary)] hover:bg-[color:var(--bg-hover)] border border-[color:var(--border-default)]"
                  }`}
                  disabled={isLoading}
                  onClick={() => handleAction(plan.key)}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("upgrade")
                  )}
                </Button>
              ) : (
                /* Downgrade — subtle text link, like ChatGPT/Claude */
                <button
                  onClick={() => handleAction(plan.key)}
                  disabled={isLoading || plan.key === "free"}
                  className="w-full py-2 text-center text-sm text-[color:var(--text-tertiary)] transition-colors hover:text-[color:var(--text-secondary)] disabled:opacity-40"
                >
                  {isLoading ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : (
                    t("downgrade")
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
