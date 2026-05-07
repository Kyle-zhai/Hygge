"use client";

// Artifact view: per-mechanism sections of bullets. Loads brief +
// findings; subscribes to decision_findings via Realtime so late-arriving
// bullets stream in. Each section's "view full details" link opens the
// MechanismRunDrawer.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  type DecisionBriefSummary,
  type Finding,
  type MechanismKind,
  type MechanismRunSummary,
} from "@/lib/decide/types";
import { MechanismSection } from "@/components/decide/mechanism-section";
import { ConflictWarningBlock } from "@/components/decide/conflict-warning-block";
import { rerunBrief } from "@/lib/decide/use-decision-session";

export default function ArtifactViewPage({
  params,
}: {
  params: Promise<{ sessionId: string; briefId: string; locale: string }>;
}) {
  const { sessionId, briefId, locale } = use(params);
  const t = useTranslations("decide");
  const intlLocale = useLocale();
  void intlLocale;

  const [brief, setBrief] = useState<DecisionBriefSummary | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [runs, setRuns] = useState<MechanismRunSummary[]>([]);
  const [rerunPending, setRerunPending] = useState(false);

  // Initial load + Realtime subscription on findings.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/decisions/briefs/${briefId}`).then((r) => r.json()),
      fetch(`/api/decisions/briefs/${briefId}/findings`).then((r) => r.json()),
    ]).then(
      ([
        b,
        f,
      ]: [
        { brief: DecisionBriefSummary },
        { findings: Finding[]; mechanism_runs: MechanismRunSummary[] },
      ]) => {
        if (cancelled) return;
        setBrief(b.brief);
        setFindings(f.findings ?? []);
        setRuns(f.mechanism_runs ?? []);
      },
    );

    const supabase = createClient();
    const channel = supabase
      .channel(`decision-findings-${briefId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "decision_findings",
          filter: `brief_id=eq.${briefId}`,
        },
        () => {
          // Simpler than diffing — refetch findings on any change.
          fetch(`/api/decisions/briefs/${briefId}/findings`)
            .then((r) => r.json())
            .then(
              (f: {
                findings: Finding[];
                mechanism_runs: MechanismRunSummary[];
              }) => {
                if (cancelled) return;
                setFindings(f.findings ?? []);
                setRuns(f.mechanism_runs ?? []);
              },
            );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [briefId]);

  if (!brief) {
    return (
      <div className="container max-w-4xl py-10">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  // Group findings by source_mechanism. Conflicts are kept separate.
  const mechanisms = brief.mechanism_kinds;
  const grouped = new Map<MechanismKind, Finding[]>();
  for (const k of mechanisms) grouped.set(k, []);
  const conflicts: Finding[] = [];
  for (const f of findings) {
    if (f.source_mechanism === "conflict_warning") {
      conflicts.push(f);
      continue;
    }
    const list = grouped.get(f.source_mechanism as MechanismKind);
    if (list) list.push(f);
  }

  async function handleRerun() {
    setRerunPending(true);
    try {
      await rerunBrief(briefId, { note: t("rerunNoteDefault") });
      window.location.href = `/${locale}/decide/${sessionId}`;
    } catch {
      setRerunPending(false);
    }
  }

  function copyMarkdown() {
    const md = buildMarkdown(brief!, mechanisms, grouped, conflicts);
    void navigator.clipboard.writeText(md);
  }

  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-6">
        <Link
          href={`/${locale}/decide/${sessionId}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← {t("backToChat")}
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <h1 className="text-lg font-semibold">{brief.canonical_question}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{brief.decision_type ?? "—"}</Badge>
            {brief.primary_dimensions.map((d) => (
              <Badge key={d} variant="secondary">
                {d}
              </Badge>
            ))}
            <Badge variant={brief.status === "completed" ? "default" : "outline"}>
              {brief.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {brief.finalized_at ? (
            <p>
              {t("generatedAt")}:{" "}
              {new Date(brief.finalized_at).toLocaleString()}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {mechanisms.map((k) => (
          <MechanismSection
            key={k}
            sessionId={sessionId}
            briefId={briefId}
            kind={k}
            findings={grouped.get(k) ?? []}
            run={runs.find((r) => r.kind === k) ?? null}
          />
        ))}

        <ConflictWarningBlock findings={conflicts} />
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Button onClick={handleRerun} disabled={rerunPending}>
          {rerunPending ? t("rerunPending") : t("rerunButton")}
        </Button>
        <Button variant="outline" onClick={copyMarkdown}>
          {t("copyMarkdown")}
        </Button>
      </div>
    </div>
  );
}

function buildMarkdown(
  brief: DecisionBriefSummary,
  mechanisms: MechanismKind[],
  grouped: Map<MechanismKind, Finding[]>,
  conflicts: Finding[],
): string {
  const lines: string[] = [];
  lines.push(`# ${brief.canonical_question}`, "");
  lines.push(`Type: ${brief.decision_type ?? "—"}`);
  lines.push(`Dimensions: ${brief.primary_dimensions.join(", ") || "—"}`);
  lines.push(`Status: ${brief.status}`, "");

  for (const k of mechanisms) {
    const list = grouped.get(k) ?? [];
    if (list.length === 0) continue;
    lines.push(`## ${k}`, "");
    for (const f of list) {
      lines.push(
        `- ${f.headline}  (severity ${f.severity} · confidence ${Math.round(f.confidence * 100)}%)`,
      );
      if (f.detail_summary) lines.push(`    ${f.detail_summary}`);
    }
    lines.push("");
  }

  if (conflicts.length > 0) {
    lines.push("## ⚠ Conflict warnings", "");
    for (const f of conflicts) {
      lines.push(`- ${f.headline}`);
      if (f.detail_summary) lines.push(`    ${f.detail_summary}`);
    }
  }

  return lines.join("\n");
}
