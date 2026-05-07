"use client";

// Single-mechanism details page. The drawer (MechanismRunDrawer) is the
// preferred entry-point inside the artifact view, but a permanent route
// makes "view details" deep-linkable and shareable.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UtteranceFeedbackButtons } from "@/components/evaluation/utterance-feedback-buttons";
import {
  MECHANISM_ICONS,
  MECHANISM_LABELS_EN,
  MECHANISM_LABELS_ZH,
  type MechanismKind,
} from "@/lib/decide/types";

interface MechanismRun {
  id: string;
  brief_id: string;
  kind: MechanismKind;
  status: string;
  raw_output:
    | {
        findings?: Array<{ headline: string; detail_summary: string; severity: number }>;
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
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/decisions/mechanism-runs/${runId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`mechanism-run fetch ${r.status}`);
        return r.json();
      })
      .then((data: { run: MechanismRun }) => {
        if (!cancelled) setRun(data.run);
      })
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
      <div className="container max-w-4xl py-10">
        <p className="text-sm text-destructive">{loadError}</p>
      </div>
    );
  }
  if (!run) {
    return (
      <div className="container max-w-4xl py-10">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  const transcript = run.raw_output?.raw_transcript;

  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-6">
        <Link
          href={`/${locale}/decide/${sessionId}/artifacts/${briefId}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← {t("backToArtifact")}
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <h1 className="text-lg font-semibold">
            {MECHANISM_ICONS[run.kind]} {labels[run.kind]}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("statusLabel")}: {run.status}
          </p>
        </CardHeader>
        {run.raw_output?.findings && run.raw_output.findings.length > 0 && (
          <CardContent>
            <h2 className="mb-2 text-sm font-medium">{t("findingsRecap")}</h2>
            <ul className="space-y-1 text-sm">
              {run.raw_output.findings.map((f, i) => (
                <li key={i}>• {f.headline}</li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium">{t("fullTranscript")}</h2>
        </CardHeader>
        <CardContent>
          <TranscriptBlock transcript={transcript} runId={runId} />
        </CardContent>
      </Card>
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
