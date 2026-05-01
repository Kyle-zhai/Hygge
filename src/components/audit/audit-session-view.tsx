"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Clock, Loader2, AlertTriangle, FileDown, Repeat } from "lucide-react";
import type {
  AuditFinding,
  AuditFindingDisposition,
  AuditFindingKind,
  AuditSession,
  AuditSignoff,
  AuditTemplate,
} from "@/lib/audit/types";
import { RiskHeatmap } from "./risk-heatmap";
import { FindingRow } from "./finding-row";
import { SignoffBlock } from "./signoff-block";
import { createClient } from "@/lib/supabase/client";
import { riskTier, compareByRiskDesc, type RiskTier } from "@/lib/audit/risk-tier";

interface Props {
  session: AuditSession;
  findings: AuditFinding[];
  signoffs: AuditSignoff[];
  locale: string;
  currentUserId: string;
}

const KIND_ORDER: AuditFindingKind[] = ["risk", "blind_spot", "dissent", "mitigation", "no_risk"];

export function AuditSessionView({
  session: initialSession,
  findings: initialFindings,
  signoffs: initialSignoffs,
  locale,
  currentUserId,
}: Props) {
  const t = useTranslations("audit");
  const [session, setSession] = useState(initialSession);
  const [findings, setFindings] = useState(initialFindings);
  const [signoffs, setSignoffs] = useState(initialSignoffs);
  const [dispositionError, setDispositionError] = useState<string | null>(null);

  // Subscribe to live updates while the audit is running.
  useEffect(() => {
    if (session.status === "signed_off" || session.status === "archived") return;

    const supabase = createClient();
    const channel = supabase
      .channel(`audit-session-${session.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audit_findings", filter: `session_id=eq.${session.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setFindings((prev) => [...prev, payload.new as AuditFinding]);
          } else if (payload.eventType === "UPDATE") {
            setFindings((prev) =>
              prev.map((f) => (f.id === (payload.new as AuditFinding).id ? (payload.new as AuditFinding) : f))
            );
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "audit_sessions", filter: `id=eq.${session.id}` },
        (payload) => setSession(payload.new as AuditSession)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_signoffs", filter: `session_id=eq.${session.id}` },
        (payload) => setSignoffs((prev) => [...prev, payload.new as AuditSignoff])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.id, session.status]);

  const findingsByKind = useMemo(() => {
    const grouped = new Map<AuditFindingKind, AuditFinding[]>();
    for (const kind of KIND_ORDER) grouped.set(kind, []);
    for (const f of findings) {
      grouped.get(f.finding_kind)?.push(f);
    }
    // Sort each kind's findings by S×P desc so the most acute risks
    // surface first — users no longer have to scan the whole list to
    // find the worst items.
    for (const list of grouped.values()) list.sort(compareByRiskDesc);
    return grouped;
  }, [findings]);

  const tierCountsByKind = useMemo(() => {
    const out = new Map<AuditFindingKind, Record<RiskTier, number>>();
    for (const [kind, list] of findingsByKind.entries()) {
      const counts: Record<RiskTier, number> = {
        critical: 0, high: 0, medium: 0, low: 0, unrated: 0,
      };
      for (const f of list) counts[riskTier(f.severity, f.probability).tier] += 1;
      out.set(kind, counts);
    }
    return out;
  }, [findingsByKind]);

  const allDispositioned = useMemo(
    () => findings.length > 0 && findings.filter((f) => f.finding_kind !== "no_risk" && f.finding_kind !== "mitigation").every((f) => !!f.user_disposition),
    [findings]
  );

  const isRunning = session.status === "pending" || session.status === "running";
  const canSignoff = session.status === "findings_ready" && allDispositioned && !signoffs.some((s) => s.actor_id === currentUserId);
  const isSignedOff = session.status === "signed_off";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      <div className="space-y-6 min-w-0">
        <SessionStatusBar session={session} t={t} />

        {findings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-6 py-10 text-center text-sm text-[color:var(--text-tertiary)]">
            {t("findingsEmpty")}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">{t("findingsTitle")}</h2>
              {isRunning && (
                <span className="inline-flex items-center gap-1 text-xs text-[color:var(--text-tertiary)]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("findingsLiveBadge")}
                </span>
              )}
            </div>

            {dispositionError && (
              <div
                role="alert"
                className="rounded-xl border border-[#F87171]/40 bg-[#F87171]/10 px-4 py-2 text-sm text-[#F87171]"
              >
                {dispositionError}
              </div>
            )}

            {KIND_ORDER.map((kind) => {
              const list = findingsByKind.get(kind) ?? [];
              if (list.length === 0) return null;
              const counts = tierCountsByKind.get(kind);
              const showTierChips =
                kind === "risk" || kind === "blind_spot" || kind === "dissent";
              return (
                <div key={kind} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs uppercase tracking-wider text-[color:var(--text-tertiary)]">
                      {t(`findingKind${findingKindKey(kind)}` as never)} · {list.length}
                    </h3>
                    {showTierChips && counts && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(["critical", "high", "medium", "low"] as const).map((tier) => {
                          if (!counts[tier]) return null;
                          // Map a tier label to the matching style by passing
                          // a representative S×P score into riskTier (the
                          // numbers don't reach the UI; only the styling).
                          const sample =
                            tier === "critical" ? riskTier(5, 5) :
                            tier === "high" ? riskTier(4, 4) :
                            tier === "medium" ? riskTier(3, 3) :
                            riskTier(2, 2);
                          return (
                            <span
                              key={tier}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                              style={{
                                backgroundColor: sample.bgSoft,
                                color: sample.bg,
                                border: `1px solid ${sample.border}`,
                              }}
                            >
                              <span>{counts[tier]}</span>
                              <span>{t(`riskTier${tier[0].toUpperCase() + tier.slice(1)}` as never)}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {list.map((finding) => (
                      <FindingRow
                        key={finding.id}
                        finding={finding}
                        sessionStatus={session.status}
                        locale={locale}
                        onDispositionChange={(disposition, note) =>
                          handleDispositionChange(
                            finding,
                            disposition,
                            note,
                            setFindings,
                            setDispositionError,
                            t("dispositionSaveFailed"),
                          )
                        }
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {(canSignoff || isSignedOff) && (
          <SignoffBlock
            sessionId={session.id}
            signoffs={signoffs}
            currentUserId={currentUserId}
            canSignoff={canSignoff}
          />
        )}

        {(session.status === "signed_off" || session.status === "findings_ready") && (
          <div className="flex flex-wrap gap-2 pt-2">
            <a
              href={`/${locale}/audit/${session.id}/report?autoprint=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-3 py-1.5 text-sm text-[color:var(--text-secondary)] transition-colors hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-primary)]"
            >
              <FileDown className="h-3.5 w-3.5" />
              {t("exportPdfButton")}
            </a>
            <a
              href={`/api/audit/${session.id}/export.json`}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-3 py-1.5 text-sm text-[color:var(--text-secondary)] transition-colors hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-primary)]"
            >
              {t("exportJsonButton")}
            </a>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-3 py-1.5 text-sm text-[color:var(--text-secondary)] transition-colors hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-primary)]"
            >
              <Repeat className="h-3.5 w-3.5" />
              {t("rerunOnDiffButton")}
            </button>
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <RiskHeatmap findings={findings} locale={locale} />

        <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-4 text-xs text-[color:var(--text-tertiary)] space-y-2">
          <div className="font-medium text-[color:var(--text-primary)]">{t("auditTrailTitle")}</div>
          <p>{t("auditTrailVerifyHint")}</p>
          {session.audit_trail_head_hash && (
            <div className="font-mono text-[10px] break-all rounded-md bg-[color:var(--bg-primary)] px-2 py-1.5 text-[color:var(--text-secondary)]">
              {session.audit_trail_head_hash}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

async function handleDispositionChange(
  original: AuditFinding,
  disposition: AuditFindingDisposition,
  note: string | null,
  setFindings: React.Dispatch<React.SetStateAction<AuditFinding[]>>,
  setDispositionError: React.Dispatch<React.SetStateAction<string | null>>,
  errorMessage: string,
) {
  setFindings((prev) =>
    prev.map((f) =>
      f.id === original.id
        ? {
            ...f,
            user_disposition: disposition,
            user_disposition_note: note,
            user_disposition_at: new Date().toISOString(),
          }
        : f
    )
  );
  setDispositionError(null);

  try {
    const res = await fetch(`/api/audit/findings/${original.id}/disposition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disposition, note }),
    });
    if (!res.ok) {
      throw new Error(`disposition save failed: HTTP ${res.status}`);
    }
  } catch (err) {
    console.error("Failed to save disposition", err);
    setFindings((curr) => curr.map((f) => (f.id === original.id ? original : f)));
    setDispositionError(errorMessage);
  }
}

function SessionStatusBar({
  session,
  t,
}: {
  session: AuditSession;
  t: ReturnType<typeof useTranslations>;
}) {
  const status = session.status;
  const Icon =
    status === "running" || status === "pending"
      ? Loader2
      : status === "signed_off"
      ? CheckCircle2
      : status === "failed"
      ? AlertTriangle
      : Clock;

  return (
    <div className="flex items-center gap-2 text-sm text-[color:var(--text-tertiary)]">
      <Icon className={`h-4 w-4 ${status === "running" || status === "pending" ? "animate-spin" : ""}`} />
      <span>{t(`sessionStatus${sessionStatusKey(status)}` as never)}</span>
    </div>
  );
}

function sessionStatusKey(status: AuditSession["status"]): string {
  return ({
    pending: "Pending",
    running: "Running",
    findings_ready: "FindingsReady",
    signed_off: "SignedOff",
    archived: "Archived",
    failed: "Failed",
  } as const)[status];
}

function findingKindKey(kind: AuditFindingKind): string {
  return ({
    risk: "Risk",
    blind_spot: "BlindSpot",
    dissent: "Dissent",
    mitigation: "Mitigation",
    no_risk: "NoRisk",
  } as const)[kind];
}
