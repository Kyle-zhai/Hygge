"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, ScanSearch } from "lucide-react";

interface Props {
  auditSessionId: string;
  locale: string;
  startLabel: string;
  hintLabel: string;
  betaLabel: string;
}

export function AuditScopingEntry({
  auditSessionId,
  locale,
  startLabel,
  hintLabel,
  betaLabel,
}: Props) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch("/api/audit/scoping/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audit_session_id: auditSessionId,
          reply_language: locale === "zh" ? "zh" : "en",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "start_failed");
      }
      router.push(`/${locale}/audit/${auditSessionId}/scope`);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "start_failed");
      setIsPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-4 py-3 flex items-center gap-3">
      <ScanSearch className="h-4 w-4 text-[color:var(--accent-warm)] shrink-0" />
      <div className="flex-1 text-xs text-[color:var(--text-tertiary)]">
        <span className="text-[color:var(--text-primary)] font-medium">{startLabel}</span>
        <span className="ml-2 inline-flex items-center rounded-full border border-[color:var(--accent-warm)]/40 bg-[rgb(var(--accent-warm-rgb)/0.10)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[color:var(--accent-warm)]">
          {betaLabel}
        </span>
        <div className="text-[color:var(--text-tertiary)] mt-0.5">{hintLabel}</div>
        {error && <div className="mt-1 text-[#F87171]">{error}</div>}
      </div>
      <button
        type="button"
        onClick={start}
        disabled={isPending}
        className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-3 py-1.5 text-xs text-[color:var(--text-primary)] transition-colors hover:border-[color:var(--accent-warm)] disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ArrowRight className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}
