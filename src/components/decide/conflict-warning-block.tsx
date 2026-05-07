"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Finding } from "@/lib/decide/types";

export function ConflictWarningBlock({ findings }: { findings: Finding[] }) {
  const t = useTranslations("decide");
  if (findings.length === 0) return null;

  return (
    <Card className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200">
          ⚠ {t("conflictWarningTitle")}
        </h3>
        <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
          {t("conflictWarningSubtitle")}
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {findings.map((f) => (
            <li key={f.id} className="rounded-md border border-amber-500/30 bg-background/50 p-3">
              <p className="text-sm font-medium">{f.headline}</p>
              {f.detail_summary && (
                <p className="mt-1 text-xs text-muted-foreground">{f.detail_summary}</p>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
