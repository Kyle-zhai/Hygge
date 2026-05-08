"use client";

// Top-of-report synthesis card. Generated client-side from the existing
// findings (no extra API call) — picks the conflict_warning rows for the
// "Top risks" block and the highest severity * confidence findings for
// the recommendation. Placeholder until a server-side synthesis pass is
// added; designed so it always shows something useful even when
// reflection_ranker hasn't produced conflicts.

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Finding } from "@/lib/decide/types";

interface Props {
  findings: Finding[];
  isComplete: boolean;
}

export function SynthesisCard({ findings, isComplete }: Props) {
  const t = useTranslations("decide");

  const { topRisks, leadFinding } = useMemo(() => {
    const conflicts = findings.filter((f) => f.source_mechanism === "conflict_warning");
    const nonConflicts = findings.filter((f) => f.source_mechanism !== "conflict_warning");
    // Score = severity (1-5) * confidence (0-1). Stable enough for a
    // first-pass "lead with the most important finding" heuristic until
    // a real synthesis pass exists.
    const scored = [...nonConflicts].sort(
      (a, b) => b.severity * b.confidence - a.severity * a.confidence,
    );
    return {
      leadFinding: scored[0] ?? null,
      topRisks: conflicts.length > 0 ? conflicts.slice(0, 3) : scored.slice(0, 3),
    };
  }, [findings]);

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold">{t("synthesisHeading")}</h2>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isComplete && findings.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            {t("synthesisLoading")}
          </p>
        ) : !leadFinding ? (
          <p className="text-sm italic text-muted-foreground">
            {t("synthesisUnavailable")}
          </p>
        ) : (
          <>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("synthesisRecommendation")}
              </p>
              <p className="mt-1 text-sm font-medium">{leadFinding.headline}</p>
              {leadFinding.detail_summary && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {leadFinding.detail_summary}
                </p>
              )}
            </div>

            {topRisks.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("synthesisTopRisks")}
                </p>
                <ul className="mt-1 space-y-1 text-sm">
                  {topRisks.map((r) => (
                    <li key={r.id} className="flex gap-2">
                      <span className="text-muted-foreground">·</span>
                      <span>{r.headline}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
