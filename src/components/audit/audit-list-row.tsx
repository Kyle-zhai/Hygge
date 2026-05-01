"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Loader2, Trash2 } from "lucide-react";
import type { AuditSessionStatus } from "@/lib/audit/types";

interface Props {
  sessionId: string;
  href: string;
  status: AuditSessionStatus;
  // The status icon is rendered by the server component (lucide icons
  // aren't serializable across the boundary), so the parent passes it
  // as ReactNode.
  icon: React.ReactNode;
  preview: string;
  meta: React.ReactNode;
}

export function AuditListRow({
  sessionId,
  href,
  status,
  icon,
  preview,
  meta,
}: Props) {
  const t = useTranslations("audit");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canDelete = status !== "signed_off";

  function onDelete() {
    if (!canDelete) return;
    if (!window.confirm(t("indexDeleteConfirm"))) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/audit/sessions/${sessionId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? t("indexDeleteFailed"));
          return;
        }
        router.refresh();
      } catch {
        setError(t("indexDeleteFailed"));
      }
    });
  }

  // The row uses a flex layout so the link area can grow while the
  // delete button stays clickable. We avoid nesting <button> inside
  // <a>, which is invalid HTML and causes inconsistent click handling.
  return (
    <li className="flex items-center gap-2 px-2 hover:bg-[color:var(--bg-primary)]/40 transition-colors">
      <Link
        href={href}
        className="flex flex-1 items-center gap-4 px-3 py-4 min-w-0"
      >
        {icon}
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate text-[color:var(--text-primary)]">
            {preview}
          </div>
          <div className="text-xs text-[color:var(--text-tertiary)] mt-1 flex items-center gap-3">
            {meta}
          </div>
          {error && (
            <div className="mt-1 text-xs text-[#F87171]">{error}</div>
          )}
        </div>
        <ArrowRight className="h-4 w-4 text-[color:var(--text-tertiary)] shrink-0" />
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={isPending || !canDelete}
        aria-label={t("indexDeleteAria")}
        title={canDelete ? t("indexDelete") : t("indexDeleteSignedOffBlocked")}
        className="shrink-0 rounded-md p-2 mr-2 text-[color:var(--text-tertiary)] transition-colors hover:bg-[color:var(--bg-primary)] hover:text-[#F87171] disabled:opacity-30 disabled:hover:text-[color:var(--text-tertiary)] disabled:hover:bg-transparent"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>
    </li>
  );
}
