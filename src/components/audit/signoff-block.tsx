"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck, Loader2, Check } from "lucide-react";
import type { AuditSignoff } from "@/lib/audit/types";

interface Props {
  sessionId: string;
  signoffs: AuditSignoff[];
  currentUserId: string;
  canSignoff: boolean;
}

export function SignoffBlock({ sessionId, signoffs, currentUserId, canSignoff }: Props) {
  const t = useTranslations("audit");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit() {
    setError(null);
    if (!name.trim() || !role.trim()) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/audit/${sessionId}/signoff`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signature: name.trim(), role: role.trim() }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "signoff_failed");
        }
        setName("");
        setRole("");
      } catch (err) {
        console.error(err);
        setError("Failed to sign off. Try again.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-5">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="h-4 w-4 text-[color:var(--accent-warm)]" />
        <h2 className="font-semibold text-[color:var(--text-primary)]">{t("signoffTitle")}</h2>
      </div>
      <p className="text-sm text-[color:var(--text-tertiary)] mb-4">{t("signoffDescription")}</p>

      {signoffs.length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {signoffs.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 text-sm rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-3 py-2 text-[color:var(--text-primary)]"
            >
              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="font-medium">{s.signature}</span>
              <span className="text-[color:var(--text-tertiary)]">— {s.role}</span>
              {s.email_confirmed_at ? (
                <span className="ml-auto text-[10px] text-[color:var(--text-tertiary)]">
                  {new Date(s.email_confirmed_at).toLocaleString()}
                </span>
              ) : (
                <span className="ml-auto text-[10px] text-amber-600">
                  {t("signoffPending")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {canSignoff && !signoffs.some((s) => s.actor_id === currentUserId) && (
        <div className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("signoffNamePlaceholder")}
            className="w-full rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-3 py-2 text-sm text-[color:var(--text-primary)] transition-colors focus:outline-none focus:border-[color:var(--accent-warm)] focus:ring-2 focus:ring-[rgb(var(--accent-warm-rgb)/0.10)]"
          />
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t("signoffRolePlaceholder")}
            className="w-full rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-3 py-2 text-sm text-[color:var(--text-primary)] transition-colors focus:outline-none focus:border-[color:var(--accent-warm)] focus:ring-2 focus:ring-[rgb(var(--accent-warm-rgb)/0.10)]"
          />
          <p className="text-xs text-[color:var(--text-tertiary)]">{t("signoffEmailConfirmHint")}</p>
          {error && <p className="text-xs text-[#F87171]">{error}</p>}
          <button
            type="button"
            onClick={onSubmit}
            disabled={isPending || !name.trim() || !role.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--text-primary)] px-5 py-2 text-sm font-medium text-[color:var(--bg-primary)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {t("signoffSubmit")}
          </button>
        </div>
      )}
    </div>
  );
}
