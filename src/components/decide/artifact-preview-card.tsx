"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MECHANISM_ICONS,
  MECHANISM_LABELS_EN,
  MECHANISM_LABELS_ZH,
  type DecisionBriefSummary,
  type Finding,
  type MechanismRunSummary,
} from "@/lib/decide/types";

interface Props {
  sessionId: string;
  briefId: string;
}

interface BriefResponse {
  brief: DecisionBriefSummary;
}
interface FindingsResponse {
  findings: Finding[];
  mechanism_runs: MechanismRunSummary[];
}

export function ArtifactPreviewCard({ sessionId, briefId }: Props) {
  const t = useTranslations("decide");
  const locale = useLocale();
  const [brief, setBrief] = useState<DecisionBriefSummary | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [runs, setRuns] = useState<MechanismRunSummary[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/decisions/briefs/${briefId}`).then((r) => {
        if (!r.ok) throw new Error(`brief preview ${r.status}`);
        return r.json();
      }),
      fetch(`/api/decisions/briefs/${briefId}/findings`).then((r) => {
        if (!r.ok) throw new Error(`findings preview ${r.status}`);
        return r.json();
      }),
    ])
      .then(([b, f]: [BriefResponse, FindingsResponse]) => {
        if (cancelled) return;
        setBrief(b.brief);
        setFindings(f.findings ?? []);
        setRuns(f.mechanism_runs ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [briefId]);

  // On fetch failure, show a clickable error card — clicking still routes
  // to the full artifact page where the actual error is surfaced and the
  // user can retry. Better than a permanent skeleton.
  if (loadFailed) {
    return (
      <Link
        href={`/${locale}/decide/${sessionId}/artifacts/${briefId}`}
        className="max-w-[85%] self-start"
      >
        <Card className="cursor-pointer border-destructive/40 transition-shadow hover:shadow-md">
          <CardContent className="flex items-center justify-between gap-2 py-3">
            <p className="text-xs text-destructive">{t("loadFailed")}</p>
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardContent>
        </Card>
      </Link>
    );
  }

  if (!brief) {
    return (
      <Card className="max-w-[85%] self-start animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-5 w-40 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-3 w-full rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const mechanismLabels = locale === "zh" ? MECHANISM_LABELS_ZH : MECHANISM_LABELS_EN;
  const highSeverity = findings.filter((f) => f.severity >= 4).length;
  const mechanismCount = brief.mechanism_kinds.length;
  const completedCount = runs.filter((r) => r.status === "completed").length;
  const failedCount = runs.filter((r) => r.status === "failed").length;

  const statusBadge = (() => {
    if (brief.status === "completed") {
      return <Badge variant="default">{t("artifactStatusCompleted")}</Badge>;
    }
    if (brief.status === "partially_completed") {
      return <Badge variant="secondary">{t("artifactStatusPartial")}</Badge>;
    }
    if (brief.status === "failed") {
      return <Badge variant="destructive">{t("artifactStatusFailed")}</Badge>;
    }
    return <Badge variant="outline">{t("artifactStatusRunning")}</Badge>;
  })();

  return (
    <Link
      href={`/${locale}/decide/${sessionId}/artifacts/${briefId}`}
      className="max-w-[85%] self-start"
    >
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("artifactCardLabel")}
            </p>
            <p className="mt-1 text-sm font-medium line-clamp-2">
              {brief.canonical_question}
            </p>
          </div>
          {statusBadge}
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t("artifactSummary", {
              total: findings.length,
              high: highSeverity,
              mechanisms: mechanismCount,
            })}
          </p>
          <div className="flex flex-wrap gap-1">
            {brief.mechanism_kinds.map((k) => {
              const run = runs.find((r) => r.kind === k);
              const opacity =
                run?.status === "completed" ? "opacity-100"
                  : run?.status === "failed" ? "opacity-30"
                  : "opacity-50";
              return (
                <span
                  key={k}
                  className={`text-xs ${opacity}`}
                  title={mechanismLabels[k]}
                >
                  {MECHANISM_ICONS[k]} {mechanismLabels[k]}
                </span>
              );
            })}
          </div>
          {failedCount > 0 && (
            <p className="text-xs text-destructive">
              {t("artifactFailedNote", { count: failedCount })}
            </p>
          )}
          <p className="text-xs text-primary mt-1">{t("openFullReport")} →</p>
          <p className="text-xs text-muted-foreground">
            {completedCount} / {mechanismCount} {t("mechanismsCompleted")}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
