"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MECHANISM_ICONS,
  MECHANISM_LABELS_EN,
  MECHANISM_LABELS_ZH,
  type Finding,
  type MechanismKind,
  type MechanismRunSummary,
} from "@/lib/decide/types";
import { FindingBullet } from "./finding-bullet";

interface Props {
  sessionId: string;
  briefId: string;
  kind: MechanismKind;
  findings: Finding[];
  run: MechanismRunSummary | null;
}

export function MechanismSection({
  sessionId,
  briefId,
  kind,
  findings,
  run,
}: Props) {
  const t = useTranslations("decide");
  const locale = useLocale();
  const labels = locale === "zh" ? MECHANISM_LABELS_ZH : MECHANISM_LABELS_EN;

  const statusBadge = (() => {
    if (!run) return <Badge variant="outline">{t("statusPending")}</Badge>;
    if (run.status === "running") return <Badge variant="secondary">{t("statusRunning")}</Badge>;
    if (run.status === "failed") return <Badge variant="destructive">{t("statusFailed")}</Badge>;
    if (run.status === "skipped") return <Badge variant="outline">{t("statusSkipped")}</Badge>;
    return null;
  })();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <h3 className="text-base font-semibold">
          {MECHANISM_ICONS[kind]} {labels[kind]}
        </h3>
        {statusBadge}
      </CardHeader>
      <CardContent className="space-y-3">
        {run?.status === "failed" && (
          <p className="text-xs text-destructive">
            ⚠ {run.error_message ?? t("mechanismFailedGeneric")}
          </p>
        )}
        {findings.length === 0 && run?.status !== "failed" ? (
          <p className="text-xs italic text-muted-foreground">
            {run?.status === "completed" ? t("noFindings") : t("waitingForFindings")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {findings.map((f) => (
              <FindingBullet key={f.id} finding={f} />
            ))}
          </ul>
        )}
        {run && run.status === "completed" && (
          <Link
            href={`/${locale}/decide/${sessionId}/artifacts/${briefId}/mechanism/${run.id}`}
            className="inline-block text-xs text-primary hover:underline"
          >
            {t("viewFullDetails")} →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
