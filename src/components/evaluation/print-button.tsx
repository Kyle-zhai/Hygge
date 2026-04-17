"use client";

import { useLocale } from "next-intl";
import { Printer } from "lucide-react";

export function PrintButton() {
  const locale = useLocale();
  const label = locale === "zh" ? "导出 PDF" : "Export PDF";

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-1.5 text-xs text-[#9B9594] transition-colors hover:border-[#3A3A3A] hover:text-[#EAEAE8]"
    >
      <Printer className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
