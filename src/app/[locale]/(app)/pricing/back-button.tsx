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
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#9B9594] transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>{locale === "zh" ? "返回" : "Back"}</span>
    </button>
  );
}
