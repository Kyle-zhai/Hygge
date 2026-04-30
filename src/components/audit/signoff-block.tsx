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
    <div className="rounded-md border border-border bg-card/40 p-5">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="h-4 w-4" />
        <h2 className="font-semibold">{t("signoffTitle")}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{t("signoffDescription")}</p>

      {signoffs.length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {signoffs.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 text-sm rounded border border-border bg-background/40 px-3 py-2"
            >
              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="font-medium">{s.signature}</span>
              <span className="text-muted-foreground">— {s.role}</span>
              {s.email_confirmed_at ? (
                <span className="ml-auto text-[10px] text-muted-foreground">
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
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t("signoffRolePlaceholder")}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
          <p className="text-xs text-muted-foreground">{t("signoffEmailConfirmHint")}</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="button"
            onClick={onSubmit}
            disabled={isPending || !name.trim() || !role.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
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
