"use client";

import { useTranslations } from "next-intl";
import type { Finding } from "@/lib/decide/types";
import { cn } from "@/lib/utils";

const SEVERITY_CLASS: Record<number, string> = {
  // Designed to keep contrast adequate in both light and dark modes and
  // to add a non-color cue ("L1"/"L2"/.../"L5") so a colorblind reader can
  // still rank severity. The L# prefix is the secondary signal — color
  // is the primary, but never the only.
  1: "bg-muted text-muted-foreground border-muted-foreground/20",
  2: "bg-secondary text-secondary-foreground border-secondary/40",
  3: "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700",
  4: "bg-orange-50 text-orange-900 border-orange-300 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-700",
  5: "bg-destructive/10 text-destructive border-destructive/40",
};

export function FindingBullet({ finding }: { finding: Finding }) {
  const t = useTranslations("decide");
  const severityKey = String(finding.severity) as "1" | "2" | "3" | "4" | "5";
  const severityLabel = t(`severityLabel.${severityKey}` as const);
  const confidencePct = Math.round(finding.confidence * 100);

  return (
    <li className="flex gap-3 rounded-md border bg-card p-3">
      <span
        className={cn(
          "h-fit shrink-0 rounded border px-2 py-0.5 text-xs font-medium",
          SEVERITY_CLASS[finding.severity],
        )}
        aria-label={`severity ${finding.severity} of 5: ${severityLabel}`}
      >
        L{finding.severity} · {severityLabel}
      </span>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{finding.headline}</p>
        {finding.detail_summary && (
          <p className="text-xs text-muted-foreground">{finding.detail_summary}</p>
        )}
        <p className="text-xs text-muted-foreground" title={t("confidenceTooltip")}>
          {t("confidence")}: {confidencePct}%
        </p>
      </div>
    </li>
  );
}
