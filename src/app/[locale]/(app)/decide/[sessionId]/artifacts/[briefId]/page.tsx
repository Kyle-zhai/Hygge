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
import { Badge } from "@/components/ui/badge";
import {
  type DecisionBriefSummary,
  type Finding,
  type MechanismKind,
  type MechanismRunSummary,
} from "@/lib/decide/types";
import { MechanismSection } from "@/components/decide/mechanism-section";
import { ConflictWarningBlock } from "@/components/decide/conflict-warning-block";
import { SynthesisCard } from "@/components/decide/synthesis-card";
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
  const [loadError, setLoadError] = useState<string | null>(null);

  // Initial load + Realtime subscription on findings. The .catch is what
  // keeps the page recoverable when the API returns 401/403/500 — without
  // it, brief stays null forever and the loading skeleton is permanent.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/decisions/briefs/${briefId}`).then((r) => {
        if (!r.ok) throw new Error(`brief fetch ${r.status}`);
        return r.json();
      }),
      fetch(`/api/decisions/briefs/${briefId}/findings`).then((r) => {
        if (!r.ok) throw new Error(`findings fetch ${r.status}`);
        return r.json();
      }),
    ])
      .then(
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
      )
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load report");
      });

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

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <p className="text-sm text-destructive">{loadError}</p>
      </div>
    );
  }
  if (!brief) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
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
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-6">
        <Link
          href={`/${locale}/decide/${sessionId}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← {t("backToChat")}
        </Link>
      </div>

      {/* Brief header — bare layout (no Card wrapper) so the SynthesisCard
          below carries the only "important" elevation in the report. */}
      <header className="mb-6">
        <h1 className="text-lg font-semibold">{brief.canonical_question}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          {brief.decision_type ? (
            <Badge variant="outline">
              {t(`decisionTypeLabel.${brief.decision_type}` as const)}
            </Badge>
          ) : null}
          {brief.primary_dimensions.map((d) => (
            <Badge key={d} variant="secondary">
              {t(`dimensionLabel.${d}` as const)}
            </Badge>
          ))}
          <Badge variant={brief.status === "completed" ? "default" : "outline"}>
            {t(`briefStatusLabel.${brief.status}` as const)}
          </Badge>
        </div>
        {brief.finalized_at ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("generatedAt")}: {new Date(brief.finalized_at).toLocaleString()}
          </p>
        ) : null}
      </header>

      <div className="mb-6">
        <SynthesisCard
          findings={findings}
          isComplete={brief.status === "completed" || brief.status === "partially_completed"}
        />
      </div>

      <div className="space-y-2">
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

        {conflicts.length > 0 && (
          <div className="pt-4">
            <ConflictWarningBlock findings={conflicts} />
          </div>
        )}
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
