"use client";

// In-context drilldown for a mechanism run. The structured mechanism_view
// (table / scenario cards / mental model) is the primary content; the
// raw transcript is demoted to a collapsible "Original transcript" at
// the bottom.
//
// AGENTS.md flywheel: <UtteranceFeedbackButtons /> must render on every
// persona utterance inside the transcript view — keeps the training-data
// loop intact even though transcripts are now off-by-default.

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { MechanismViewBlock } from "./mechanism-view-block";
import { EvidenceChips } from "./evidence-chips";

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
    findings?: Array<{
      headline: string;
      detail_summary: string;
      evidence?: FindingEvidence[];
    }>;
    mechanism_view?: MechanismView;
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
  const [personas, setPersonas] = useState<MechanismPersonaInfo[]>([]);
  const [prevKey, setPrevKey] = useState<string>(`${runId ?? ""}|${open}`);

  // Reset run state during render when the (runId, open) tuple changes.
  // setState-in-effect is forbidden by the project lint rule.
  const currentKey = `${runId ?? ""}|${open}`;
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setRun(null);
    setPersonas([]);
  }

  useEffect(() => {
    if (!runId || !open) return;
    let cancelled = false;
    fetch(`/api/decisions/mechanism-runs/${runId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`mechanism-run fetch ${r.status}`);
        return r.json();
      })
      .then(
        (data: { run: MechanismRunPayload; personas?: MechanismPersonaInfo[] }) => {
          if (cancelled) return;
          setRun(data.run);
          setPersonas(data.personas ?? []);
        },
      )
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
          <DialogDescription>{t("mechanismDrawerSubtitle")}</DialogDescription>
        </DialogHeader>
        {!run ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : run.status === "failed" ? (
          <p className="text-sm text-destructive">
            {run.error_message ?? t("mechanismFailedGeneric")}
          </p>
        ) : (
          <RunBody raw={run.raw_output} runId={run.id} personas={personas} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RunBody({
  raw,
  runId,
  personas,
}: {
  raw: MechanismRunPayload["raw_output"];
  runId: string;
  personas: MechanismPersonaInfo[];
}) {
  const t = useTranslations("decide");
  if (!raw) return <p className="text-sm text-muted-foreground">{t("noTranscript")}</p>;

  const view = raw.mechanism_view;
  const findings = raw.findings ?? [];
  const transcript = raw.raw_transcript;

  return (
    <div className="space-y-5">
      {view && (
        <section>
          <MechanismViewBlock view={view} personas={personas} />
        </section>
      )}

      {findings.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("findingsRecap")}
          </h4>
          <ul className="space-y-3">
            {findings.map((f, i) => (
              <li key={i} className="rounded-md border border-border bg-card p-3">
                <p className="text-sm font-medium text-foreground">{f.headline}</p>
                {f.detail_summary && (
                  <p className="mt-1 text-sm text-muted-foreground">{f.detail_summary}</p>
                )}
                <EvidenceChips evidence={f.evidence} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {transcript ? (
        <details className="rounded-md border border-border">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            {t("originalTranscriptToggle")}
          </summary>
          <div className="border-t border-border/60 p-3">
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
  transcript:
    | string
    | Array<{ persona_id?: string; persona_name?: string; text?: string; round?: number }>
    | Record<string, unknown>;
  runId: string;
}) {
  const t = useTranslations("decide");

  if (typeof transcript === "string") {
    return (
      <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{transcript}</p>
    );
  }

  if (Array.isArray(transcript)) {
    return (
      <div className="space-y-3">
        {transcript.map((u, i) => (
          <div key={i} className="rounded-md border border-border bg-card p-3">
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
