"use client";

import { useTranslations } from "next-intl";
import type { Finding } from "@/lib/decide/types";
import { cn } from "@/lib/utils";

const SEVERITY_LABEL: Record<number, string> = {
  1: "info",
  2: "low",
  3: "med",
  4: "high",
  5: "critical",
};

const SEVERITY_CLASS: Record<number, string> = {
  1: "bg-muted text-muted-foreground",
  2: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  3: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  4: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  5: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function FindingBullet({ finding }: { finding: Finding }) {
  const t = useTranslations("decide");

  return (
    <li className="flex gap-3 rounded-md border bg-card p-3">
      <span
        className={cn(
          "h-fit shrink-0 rounded px-2 py-0.5 text-xs font-medium uppercase",
          SEVERITY_CLASS[finding.severity],
        )}
      >
        {SEVERITY_LABEL[finding.severity]}
      </span>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{finding.headline}</p>
        {finding.detail_summary && (
          <p className="text-xs text-muted-foreground">{finding.detail_summary}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {t("confidence")}: {Math.round(finding.confidence * 100)}%
        </p>
      </div>
    </li>
  );
}
