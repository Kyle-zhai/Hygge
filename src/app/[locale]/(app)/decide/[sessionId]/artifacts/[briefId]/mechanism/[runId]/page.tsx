"use client";

// Single-mechanism details page. Shows the structured mechanism_view
// (table / scenario cards / mental model / etc.) as the primary content,
// plus findings with their evidence chips. The raw_transcript is kept
// as a collapsible "Original transcript" affordance for power users —
// it's no longer the headline content.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UtteranceFeedbackButtons } from "@/components/feedback/utterance-feedback-buttons";
import {
  MECHANISM_ICONS,
  MECHANISM_LABELS_EN,
  MECHANISM_LABELS_ZH,
  type MechanismKind,
  type MechanismView,
  type FindingEvidence,
  type MechanismPersonaInfo,
} from "@/lib/decide/types";
import { MechanismViewBlock } from "@/components/decide/mechanism-view-block";
import { EvidenceChips } from "@/components/decide/evidence-chips";

interface MechanismRun {
  id: string;
  brief_id: string;
  kind: MechanismKind;
  status: string;
  raw_output:
    | {
        findings?: Array<{
          headline: string;
          detail_summary: string;
          severity: number;
          evidence?: FindingEvidence[];
        }>;
        mechanism_view?: MechanismView;
        raw_transcript?: unknown;
      }
    | null;
  error_message: string | null;
}

export default function MechanismRunPage({
  params,
}: {
  params: Promise<{
    sessionId: string;
    briefId: string;
    runId: string;
    locale: string;
  }>;
}) {
  const { sessionId, briefId, runId } = use(params);
  const t = useTranslations("decide");
  const locale = useLocale();
  const labels = locale === "zh" ? MECHANISM_LABELS_ZH : MECHANISM_LABELS_EN;
  const [run, setRun] = useState<MechanismRun | null>(null);
  const [personas, setPersonas] = useState<MechanismPersonaInfo[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/decisions/mechanism-runs/${runId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`mechanism-run fetch ${r.status}`);
        return r.json();
      })
      .then(
        (data: { run: MechanismRun; personas?: MechanismPersonaInfo[] }) => {
          if (cancelled) return;
          setRun(data.run);
          setPersonas(data.personas ?? []);
        },
      )
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <p className="text-sm text-destructive">{loadError}</p>
      </div>
    );
  }
  if (!run) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  const view = run.raw_output?.mechanism_view;
  const findings = run.raw_output?.findings ?? [];
  const transcript = run.raw_output?.raw_transcript;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-6">
        <Link
          href={`/${locale}/decide/${sessionId}/artifacts/${briefId}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← {t("backToArtifact")}
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {MECHANISM_ICONS[run.kind]} {labels[run.kind]}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("statusLabel")}: {run.status}
        </p>
      </header>

      {/* Primary structured view — the new replacement for the wall-of-text
          transcript. Falls back gracefully when the LLM didn't produce a
          structured payload (legacy rows, or sanitization rejected it). */}
      {view ? (
        <section className="mb-6">
          <MechanismViewBlock view={view} personas={personas} />
        </section>
      ) : null}

      {findings.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-sm font-semibold">{t("findingsRecap")}</h2>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {findings.map((f, i) => (
                <li key={i} className="border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
                  <p className="text-sm font-medium text-foreground">{f.headline}</p>
                  {f.detail_summary && (
                    <p className="mt-1 text-sm text-muted-foreground">{f.detail_summary}</p>
                  )}
                  <EvidenceChips evidence={f.evidence} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Raw transcript demoted to a power-user collapsible. The structured
          view above is the default — this is here for transparency and
          for sessions whose transcript is the actual round-table output
          worth showing line-by-line. */}
      {transcript ? (
        <details className="rounded-md border border-border bg-card">
          <summary className="cursor-pointer select-none px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground">
            {t("originalTranscriptToggle")}
          </summary>
          <div className="border-t border-border/60 p-4">
            <TranscriptBlock transcript={transcript} runId={runId} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function TranscriptBlock({
  transcript,
  runId,
}: {
  transcript: unknown;
  runId: string;
}) {
  const t = useTranslations("decide");
  if (!transcript) return <p className="text-sm text-muted-foreground">{t("noTranscript")}</p>;

  if (typeof transcript === "string") {
    return <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{transcript}</p>;
  }

  if (Array.isArray(transcript)) {
    const utterances = transcript as Array<{
      persona_id?: string;
      persona_name?: string;
      text?: string;
      round?: number;
    }>;
    return (
      <div className="space-y-3">
        {utterances.map((u, i) => (
          <div key={i} className="rounded-md border bg-card p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {u.persona_name ?? u.persona_id ?? "—"}
              {typeof u.round === "number" ? ` · ${t("round")} ${u.round}` : ""}
            </p>
            <p className="whitespace-pre-wrap text-sm">{u.text ?? ""}</p>
            {u.persona_id && u.text && (
              <div className="mt-2">
                <UtteranceFeedbackButtons
                  address={{
                    kind: "decision_mechanism",
                    mechanismRunId: runId,
                    utteranceIndex: i,
                  }}
                  personaId={u.persona_id}
                  alwaysVisible
                />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
      {JSON.stringify(transcript, null, 2)}
    </pre>
  );
}
