"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Printer } from "lucide-react";

export function ReportPrintTrigger() {
  const t = useTranslations("audit");
  const searchParams = useSearchParams();
  const autoprint = searchParams.get("autoprint") === "1";

  useEffect(() => {
    if (!autoprint) return;
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [autoprint]);

  return (
    <div className="no-print mx-auto w-full max-w-4xl px-8 pt-6 flex justify-end">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-3 py-1.5 text-sm text-[color:var(--text-secondary)] transition-colors hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-primary)]"
      >
        <Printer className="h-3.5 w-3.5" />
        {t("printReportButton")}
      </button>
    </div>
  );
}
