"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function PricingBackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#9B9594] transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>Back</span>
    </button>
  );
}
