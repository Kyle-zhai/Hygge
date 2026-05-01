"use client";

// AuditPipelineRunner
//
// Renders the post-scope-lock pipeline state for an audit session and
// auto-dispatches /api/audit/sessions/[id]/run when:
//   - scope is locked
//   - server-rendered audit_sessions.status is 'pending' (kernel hasn't started)
//
// While running, polls /api/audit/sessions/[id]/findings every ~3s until the
// status reaches a terminal state (findings_ready / failed / signed_off /
// archived). On findings_ready, refreshes the route so the report banner shows.
//
// Idempotency: the /run route is idempotent (it short-circuits if status is
// already running/findings_ready/signed_off/archived). We track an in-flight
// guard so React StrictMode double-mount in dev doesn't fire two POSTs.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { AuditSessionStatus } from "@/lib/audit/types";

interface Props {
  auditSessionId: string;
  locale: string;
  replyLanguage: "en" | "zh";
  initialStatus: AuditSessionStatus;
  initialPipelineError: string | null;
  labels: {
    runningTitle: string;
    runningSubtitle: string;
    readyTitle: string;
    readySubtitle: string;
    readyView: string;
    failedTitle: string;
    failedRetry: string;
    startError: string;
  };
}

const POLL_INTERVAL_MS = 3000;
const TERMINAL_STATES: ReadonlySet<AuditSessionStatus> = new Set([
  "findings_ready",
  "signed_off",
  "archived",
  "failed",
]);

export function AuditPipelineRunner({
  auditSessionId,
  locale,
  replyLanguage,
  initialStatus,
  initialPipelineError,
  labels,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<AuditSessionStatus>(initialStatus);
  const [pipelineError, setPipelineError] = useState<string | null>(
    initialPipelineError,
  );
  const [retrying, setRetrying] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const dispatchedRef = useRef(false);
  const previousStatusRef = useRef<AuditSessionStatus>(initialStatus);

  // Auto-dispatch /run once on mount if scope-locked but pipeline hasn't started.
  useEffect(() => {
    if (status !== "pending") return;
    if (dispatchedRef.current) return;
    dispatchedRef.current = true;
    void dispatchRun(auditSessionId, replyLanguage)
      .then((ok) => {
        if (ok) setStatus("running");
        else setStartError(labels.startError);
      })
      .catch(() => setStartError(labels.startError));
  }, [auditSessionId, replyLanguage, status, labels.startError]);

  // Poll /findings while in a non-terminal state.
  useEffect(() => {
    if (TERMINAL_STATES.has(status)) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/audit/sessions/${auditSessionId}/findings`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          status?: AuditSessionStatus;
          pipeline_error?: string | null;
        };
        if (cancelled) return;
        if (json.status && json.status !== status) {
          setStatus(json.status);
        }
        if (typeof json.pipeline_error === "string") {
          setPipelineError(json.pipeline_error);
        }
      } catch {
        // transient network blip; just try again on next tick
      }
    };
    void tick();
    const handle = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [auditSessionId, status]);

  // When we transition into findings_ready (or any terminal state) refresh the
  // server component so the rest of the page picks up the new data.
  useEffect(() => {
    const prev = previousStatusRef.current;
    previousStatusRef.current = status;
    if (prev === status) return;
    if (TERMINAL_STATES.has(status)) router.refresh();
  }, [status, router]);

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    setStartError(null);
    setPipelineError(null);
    const ok = await dispatchRun(auditSessionId, replyLanguage);
    if (ok) {
      setStatus("running");
      dispatchedRef.current = true;
    } else {
      setStartError(labels.startError);
    }
    setRetrying(false);
  }

  if (status === "running" || status === "pending") {
    return (
      <Banner tone="info" icon={<Loader2 className="h-4 w-4 animate-spin" />}>
        <div className="flex-1 text-xs text-[color:var(--text-tertiary)]">
          <span className="text-[color:var(--text-primary)] font-medium">
            {labels.runningTitle}
          </span>{" "}
          {labels.runningSubtitle}
          {startError && (
            <div className="mt-1 text-[#F87171]">{startError}</div>
          )}
        </div>
      </Banner>
    );
  }

  if (status === "findings_ready" || status === "signed_off") {
    return (
      <Banner
        tone="success"
        icon={<CheckCircle2 className="h-4 w-4 shrink-0" />}
      >
        <div className="flex-1 text-xs text-[color:var(--text-tertiary)]">
          <span className="text-[color:var(--text-primary)] font-medium">
            {labels.readyTitle}
          </span>{" "}
          {labels.readySubtitle}
        </div>
        <Link
          href={`/${locale}/audit/${auditSessionId}/report`}
          className="inline-flex items-center gap-1 text-xs text-[color:var(--text-primary)] hover:text-[color:var(--accent-warm)] transition-colors"
        >
          {labels.readyView}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </Banner>
    );
  }

  if (status === "failed") {
    return (
      <Banner
        tone="error"
        icon={<AlertTriangle className="h-4 w-4 shrink-0 text-[#F87171]" />}
      >
        <div className="flex-1 text-xs text-[#F87171]">
          <span className="font-medium">{labels.failedTitle}</span>
          {pipelineError && (
            <div className="mt-1 break-words text-[10px] opacity-80">
              {pipelineError}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="inline-flex items-center gap-1 rounded-full border border-[#F87171]/40 bg-[#F87171]/10 px-3 py-1.5 text-xs text-[#F87171] transition-colors hover:bg-[#F87171]/20 disabled:opacity-50"
        >
          {retrying ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {labels.failedRetry}
        </button>
      </Banner>
    );
  }

  return null;
}

async function dispatchRun(
  auditSessionId: string,
  replyLanguage: "en" | "zh",
): Promise<boolean> {
  try {
    const res = await fetch(`/api/audit/sessions/${auditSessionId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply_language: replyLanguage }),
    });
    // 202 (accepted) and 409 (already running/terminal) are both "ok" — the
    // pipeline either just started or was already in flight. Anything else
    // surfaces an error to the user.
    return res.ok || res.status === 409;
  } catch (err) {
    console.error("AuditPipelineRunner: /run dispatch failed", err);
    return false;
  }
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "info" | "success" | "error";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "border-[#F87171]/30 bg-[#F87171]/10"
      : tone === "success"
        ? "border-emerald-500/30 bg-emerald-500/10"
        : "border-[color:var(--accent-warm)]/40 bg-[rgb(var(--accent-warm-rgb)/0.08)]";
  const iconWrapCls =
    tone === "error"
      ? "text-[#F87171]"
      : tone === "success"
        ? "text-emerald-500"
        : "text-[color:var(--accent-warm)]";
  return (
    <div
      className={`mb-6 rounded-xl border ${cls} px-4 py-3 flex items-center gap-3`}
    >
      <div className={iconWrapCls}>{icon}</div>
      {children}
    </div>
  );
}
