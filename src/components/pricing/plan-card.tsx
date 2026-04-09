"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";

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
      className={`card-glow relative border-[#2A2A2A] bg-[#141414] transition-all duration-300 ${
        isPopular
          ? "border-[#E2DDD5] scale-[1.02]"
          : "hover:border-[#3A3A3A]"
      }`}
    >
      {isPopular && (
        <Badge
          className="absolute -top-3 left-1/2 -translate-x-1/2 border-0 px-3 py-1 text-xs font-medium text-[#0C0C0C] bg-[#E2DDD5]"
        >
          {popularLabel}
        </Badge>
      )}
      <CardHeader className="text-center pt-8">
        <CardTitle className="text-xl text-[#EAEAE8] font-semibold">
          {name}
        </CardTitle>
        <div className="mt-4">
          <span className="text-5xl font-semibold text-[#EAEAE8]">
            {price}
          </span>
          {price !== "$0" && (
            <span className="ml-1 text-[#666462]">{perMonth}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <ul className="space-y-3">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-[#9B9594]">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#4ADE80]" />
              {feature}
            </li>
          ))}
        </ul>
        <Button
          className={`w-full ${
            isCurrent
              ? "border-[#2A2A2A] bg-transparent text-[#666462] hover:bg-[#1C1C1C]"
              : isPopular
              ? "bg-[#E2DDD5] hover:bg-[#D4CFC7] text-[#0C0C0C] btn-glow font-semibold"
              : "border-[#2A2A2A] bg-[#1C1C1C] text-[#EAEAE8] hover:bg-[#222222]"
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
