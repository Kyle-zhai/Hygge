"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, ArrowRight } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
  const elapsed = useElapsedSeconds(run?.status === "running");

  const isRunning = run?.status === "running";

  const statusBadge = (() => {
    if (!run) return <Badge variant="outline">{t("statusPending")}</Badge>;
    if (run.status === "running") {
      return (
        <Badge variant="secondary" className="font-mono tabular-nums">
          {t("statusRunning")} · {t("elapsedSeconds", { n: elapsed })}
        </Badge>
      );
    }
    if (run.status === "failed") return <Badge variant="destructive">{t("statusFailed")}</Badge>;
    if (run.status === "skipped") return <Badge variant="outline">{t("statusSkipped")}</Badge>;
    return null;
  })();

  // Section instead of Card to break the card-in-card stacking that the
  // designer audit flagged. The colored left border carries weight that
  // a bordered Card was carrying before, with less visual noise.
  return (
    <section
      className={cn(
        "border-l-2 pl-4 py-3 transition-colors",
        isRunning ? "border-primary" : "border-border",
      )}
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">
          {MECHANISM_ICONS[kind]} {labels[kind]}
        </h3>
        {statusBadge}
      </header>
      <div className="space-y-3">
        {run?.status === "failed" && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            {run.error_message ?? t("mechanismFailedGeneric")}
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
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {t("viewFullDetails")} <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}

// Counter that ticks every second while running; stops when not running.
// Reset of `seconds` happens during render (React 19 pattern) so the
// project's set-state-in-effect lint rule stays happy.
function useElapsedSeconds(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  const [prevRunning, setPrevRunning] = useState(running);
  if (running !== prevRunning) {
    setPrevRunning(running);
    setSeconds(0);
  }
  useEffect(() => {
    if (!running) return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return seconds;
}
