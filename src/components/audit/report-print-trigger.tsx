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
        className="inline-flex items-center gap-2 rounded-md border border-border bg-card/30 px-3 py-1.5 text-sm hover:border-foreground/50"
      >
        <Printer className="h-3.5 w-3.5" />
        {t("printReportButton")}
      </button>
    </div>
  );
}
