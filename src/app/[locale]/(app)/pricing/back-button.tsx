"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ArrowLeft } from "lucide-react";

export function PricingBackButton() {
  const router = useRouter();
  const locale = useLocale();

  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>{locale === "zh" ? "返回" : "Back"}</span>
    </button>
  );
}
