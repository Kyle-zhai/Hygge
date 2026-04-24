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
      className="no-print inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-3 py-1.5 text-xs text-[color:var(--text-secondary)] transition-colors hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-primary)]"
    >
      <Printer className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
