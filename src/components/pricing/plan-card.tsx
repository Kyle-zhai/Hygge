"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { track } from "@/lib/analytics/posthog";

interface PlanCardProps {
  name: string;
  planKey: string;
  price: string;
  perMonth: string;
  features: string[];
  isCurrent: boolean;
  isPopular?: boolean;
  currentPlanLabel: string;
  upgradeLabel: string;
  popularLabel: string;
}

export function PlanCard({
  name,
  planKey,
  price,
  perMonth,
  features,
  isCurrent,
  isPopular,
  currentPlanLabel,
  upgradeLabel,
  popularLabel,
}: PlanCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    if (planKey === "free" || isCurrent) return;
    track("upgrade_cta_clicked", { plan: planKey });
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (data.url) {
        router.push(data.url);
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <Card
      className={`card-glow relative border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] transition-all duration-300 ${
        isPopular
          ? "border-[color:var(--accent-primary)] scale-[1.02]"
          : "hover:border-[color:var(--border-hover)]"
      }`}
    >
      {isPopular && (
        <Badge
          className="absolute -top-3 left-1/2 -translate-x-1/2 border-0 px-3 py-1 text-xs font-medium text-[color:var(--bg-primary)] bg-[color:var(--accent-primary)]"
        >
          {popularLabel}
        </Badge>
      )}
      <CardHeader className="text-center pt-8">
        <CardTitle className="text-xl text-[color:var(--text-primary)] font-semibold">
          {name}
        </CardTitle>
        <div className="mt-4">
          <span className="text-5xl font-semibold text-[color:var(--text-primary)]">
            {price}
          </span>
          {price !== "$0" && (
            <span className="ml-1 text-[color:var(--text-tertiary)]">{perMonth}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <ul className="space-y-3">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-[color:var(--text-secondary)]">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#4ADE80]" />
              {feature}
            </li>
          ))}
        </ul>
        <Button
          className={`w-full ${
            isCurrent
              ? "border-[color:var(--border-default)] bg-transparent text-[color:var(--text-tertiary)] hover:bg-[color:var(--bg-tertiary)]"
              : isPopular
              ? "bg-[color:var(--accent-primary)] hover:bg-[color:var(--accent-primary-hover)] text-[color:var(--bg-primary)] btn-glow font-semibold"
              : "border-[color:var(--border-default)] bg-[color:var(--bg-tertiary)] text-[color:var(--text-primary)] hover:bg-[color:var(--bg-hover)]"
          }`}
          variant={isCurrent ? "outline" : "default"}
          disabled={isCurrent || planKey === "free" || loading}
          onClick={handleUpgrade}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isCurrent ? (
            currentPlanLabel
          ) : (
            upgradeLabel
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
