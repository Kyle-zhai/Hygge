"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UtteranceFeedbackButtons } from "@/components/evaluation/utterance-feedback-buttons";
import {
  MECHANISM_ICONS,
  MECHANISM_LABELS_EN,
  MECHANISM_LABELS_ZH,
  type MechanismKind,
} from "@/lib/decide/types";

// Required by AGENTS.md: <UtteranceFeedbackButtons /> must render on every
// persona utterance inside this drawer — this is the training-data flywheel.

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string | null;
}

interface MechanismRunPayload {
  id: string;
  brief_id: string;
  kind: MechanismKind;
  status: string;
  raw_output: {
    findings?: Array<{ headline: string; detail_summary: string }>;
    raw_transcript?:
      | string
      | Array<{
          persona_id?: string;
          persona_name?: string;
          text?: string;
          round?: number;
        }>
      | Record<string, unknown>;
  } | null;
  error_message: string | null;
}

export function MechanismRunDrawer({ open, onOpenChange, runId }: Props) {
  const t = useTranslations("decide");
  const locale = useLocale();
  const [run, setRun] = useState<MechanismRunPayload | null>(null);
  const [prevKey, setPrevKey] = useState<string>(`${runId ?? ""}|${open}`);

  // Reset run state during render when the (runId, open) tuple changes.
  // setState-in-effect is forbidden by the project lint rule.
  const currentKey = `${runId ?? ""}|${open}`;
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setRun(null);
  }

  useEffect(() => {
    if (!runId || !open) return;
    let cancelled = false;
    fetch(`/api/decisions/mechanism-runs/${runId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`mechanism-run fetch ${r.status}`);
        return r.json();
      })
      .then((data: { run: MechanismRunPayload }) => {
        if (!cancelled) setRun(data.run);
      })
      .catch(() => {
        // Leave run=null; the parent will render a "not loaded" state.
      });
    return () => {
      cancelled = true;
    };
  }, [runId, open]);

  if (!runId) return null;
  const labels = locale === "zh" ? MECHANISM_LABELS_ZH : MECHANISM_LABELS_EN;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {run ? `${MECHANISM_ICONS[run.kind]} ${labels[run.kind]}` : t("loading")}
          </DialogTitle>
        </DialogHeader>
        {!run ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : run.status === "failed" ? (
          <p className="text-sm text-destructive">{run.error_message ?? t("mechanismFailedGeneric")}</p>
        ) : (
          <TranscriptView raw={run.raw_output} runId={run.id} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TranscriptView({
  raw,
  runId,
}: {
  raw: MechanismRunPayload["raw_output"];
  runId: string;
}) {
  const t = useTranslations("decide");
  if (!raw) return <p className="text-sm text-muted-foreground">{t("noTranscript")}</p>;

  const transcript = raw.raw_transcript;

  // Best-effort rendering: if transcript is a string, show it as a single
  // block. If it's an array of utterances, render each with feedback
  // buttons. Otherwise fall back to JSON.
  if (typeof transcript === "string") {
    return (
      <div className="space-y-4">
        {raw.findings && raw.findings.length > 0 && (
          <section>
            <h4 className="mb-2 text-sm font-semibold">{t("findingsRecap")}</h4>
            <ul className="space-y-1 text-sm">
              {raw.findings.map((f, i) => (
                <li key={i}>• {f.headline}</li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h4 className="mb-2 text-sm font-semibold">{t("fullTranscript")}</h4>
          <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
            {transcript}
          </p>
        </section>
      </div>
    );
  }

  if (Array.isArray(transcript)) {
    return (
      <div className="space-y-3">
        {transcript.map((u, i) => (
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
