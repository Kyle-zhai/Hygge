"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Check } from "lucide-react";
import type {
  AuditFinding,
  AuditFindingDisposition,
  AuditSessionStatus,
} from "@/lib/audit/types";

interface Props {
  finding: AuditFinding;
  sessionStatus: AuditSessionStatus;
  locale: string;
  onDispositionChange: (disposition: AuditFindingDisposition, note: string | null) => void;
}

const DISPOSITIONS: AuditFindingDisposition[] = [
  "accept_mitigation",
  "accept_residual",
  "reject",
  "defer",
];

export function FindingRow({ finding, sessionStatus, onDispositionChange }: Props) {
  const t = useTranslations("audit");
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(finding.user_disposition_note ?? "");

  const editable = sessionStatus !== "signed_off" && sessionStatus !== "archived";
  const skipDisposition = finding.finding_kind === "no_risk" || finding.finding_kind === "mitigation";

  return (
    <li className="rounded-md border border-border bg-card/40">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
      >
        <div className="flex flex-col gap-1 shrink-0 pt-0.5">
          {finding.severity != null && (
            <span className="text-[10px] inline-flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: severityColor(finding.severity),
                }}
              />
              <span className="text-muted-foreground">S{finding.severity}</span>
            </span>
          )}
          {finding.probability != null && (
            <span className="text-[10px] text-muted-foreground">P{finding.probability}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-relaxed">{finding.claim}</p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {finding.user_disposition && (
            <Check className="h-4 w-4 text-emerald-600" />
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {finding.suggested_mitigation && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                {t("findingMitigationLabel")}
              </div>
              <p className="text-sm leading-relaxed">{finding.suggested_mitigation}</p>
            </div>
          )}

          {!skipDisposition && editable && (
            <div className="space-y-2 pt-1">
              <div className="text-xs font-medium text-muted-foreground">
                {t("findingDispositionPrompt")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DISPOSITIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onDispositionChange(d, note || null)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                      finding.user_disposition === d
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground/50"
                    }`}
                  >
                    {t(`findingDisposition${dispositionKey(d)}` as never)}
                  </button>
                ))}
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => {
                  if (finding.user_disposition && note !== (finding.user_disposition_note ?? "")) {
                    onDispositionChange(finding.user_disposition, note || null);
                  }
                }}
                placeholder={t("findingDispositionNote")}
                rows={2}
                className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-foreground/30"
              />
            </div>
          )}

          {finding.user_disposition && !editable && (
            <div className="text-xs text-muted-foreground">
              {t(`findingDisposition${dispositionKey(finding.user_disposition)}` as never)}
              {finding.user_disposition_note && <> — {finding.user_disposition_note}</>}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function severityColor(severity: number): string {
  if (severity >= 5) return "rgb(220 38 38)";
  if (severity >= 4) return "rgb(234 88 12)";
  if (severity >= 3) return "rgb(202 138 4)";
  if (severity >= 2) return "rgb(101 163 13)";
  return "rgb(34 197 94)";
}

function dispositionKey(d: AuditFindingDisposition): string {
  return ({
    accept_mitigation: "Accept",
    accept_residual: "Residual",
    reject: "Reject",
    defer: "Defer",
  } as const)[d];
}
