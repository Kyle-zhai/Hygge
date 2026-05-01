"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Check } from "lucide-react";
import type {
  AuditFinding,
  AuditFindingDisposition,
  AuditSessionStatus,
} from "@/lib/audit/types";
import { riskTier } from "@/lib/audit/risk-tier";

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

  const tier = riskTier(finding.severity, finding.probability);
  const tierLabel = t(`riskTier${tierKey(tier.tier)}` as never);

  return (
    <li
      className="relative rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] overflow-hidden"
      style={{ boxShadow: `inset 6px 0 0 0 ${tier.bg}` }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-4 pl-6 pr-4 py-3 text-left"
      >
        {/* Tier badge — single, prominent. Replaces the previous tiny S/P
            stack. The S×P numerals stay below as a smaller subtitle for
            users who want the underlying components. */}
        <div className="shrink-0 flex flex-col items-stretch gap-1 w-20 pt-0.5">
          <span
            className="inline-flex items-center justify-center rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ backgroundColor: tier.bg, color: tier.fg }}
          >
            {tierLabel}
          </span>
          {tier.score != null && (
            <span className="text-center text-[11px] font-mono text-[color:var(--text-tertiary)]">
              {finding.severity}×{finding.probability} = {tier.score}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm leading-relaxed">{finding.claim}</p>
        </div>
        <div className="shrink-0 flex items-center gap-2 pt-1">
          {finding.user_disposition && (
            <Check className="h-4 w-4 text-emerald-600" />
          )}
          <ChevronDown
            className={`h-4 w-4 text-[color:var(--text-tertiary)] transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[color:var(--border-default)] px-4 py-3 space-y-3">
          {finding.suggested_mitigation && (
            <div>
              <div className="text-xs font-medium text-[color:var(--text-tertiary)] mb-1">
                {t("findingMitigationLabel")}
              </div>
              <p className="text-sm leading-relaxed">{finding.suggested_mitigation}</p>
            </div>
          )}

          {!skipDisposition && editable && (
            <div className="space-y-2 pt-1">
              <div className="text-xs font-medium text-[color:var(--text-tertiary)]">
                {t("findingDispositionPrompt")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DISPOSITIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onDispositionChange(d, note || null)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      finding.user_disposition === d
                        ? "border-[color:var(--text-primary)] bg-[color:var(--text-primary)] text-[color:var(--bg-primary)]"
                        : "border-[color:var(--border-default)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-primary)]"
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
                className="w-full text-xs rounded-md border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-2 py-1.5 text-[color:var(--text-primary)] focus:outline-none focus:border-[color:var(--accent-warm)] focus:ring-1 focus:ring-[rgb(var(--accent-warm-rgb)/0.30)]"
              />
            </div>
          )}

          {finding.user_disposition && !editable && (
            <div className="text-xs text-[color:var(--text-tertiary)]">
              {t(`findingDisposition${dispositionKey(finding.user_disposition)}` as never)}
              {finding.user_disposition_note && <> — {finding.user_disposition_note}</>}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function tierKey(t: "critical" | "high" | "medium" | "low" | "unrated"): string {
  return ({
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
    unrated: "Unrated",
  } as const)[t];
}

function dispositionKey(d: AuditFindingDisposition): string {
  return ({
    accept_mitigation: "Accept",
    accept_residual: "Residual",
    reject: "Reject",
    defer: "Defer",
  } as const)[d];
}
