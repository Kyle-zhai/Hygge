"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const canDelete = status !== "signed_off";

  function openConfirm(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canDelete) return;
    setError(null);
    setConfirmOpen(true);
  }

  function closeConfirm() {
    if (isPending) return;
    setConfirmOpen(false);
  }

  function runDelete() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/audit/sessions/${sessionId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? t("indexDeleteFailed"));
          setConfirmOpen(false);
          return;
        }
        setConfirmOpen(false);
        router.refresh();
      } catch {
        setError(t("indexDeleteFailed"));
        setConfirmOpen(false);
      }
    });
  }

  return (
    <>
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
          onClick={openConfirm}
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

      <AnimatePresence>
        {confirmOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeConfirm}
              className="fixed inset-0 z-[60] bg-black/60"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`audit-delete-${sessionId}-title`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="fixed left-1/2 top-1/2 z-[70] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-6 shadow-2xl"
            >
              <h3
                id={`audit-delete-${sessionId}-title`}
                className="text-base font-semibold text-[color:var(--text-primary)] mb-2"
              >
                {t("indexDeleteTitle")}
              </h3>
              <p className="text-sm text-[color:var(--text-secondary)] mb-6">
                {t("indexDeleteConfirm")}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeConfirm}
                  disabled={isPending}
                  className="rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-tertiary)] px-4 py-2 text-sm text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--bg-hover)] disabled:opacity-50"
                >
                  {t("indexDeleteCancel")}
                </button>
                <button
                  type="button"
                  onClick={runDelete}
                  disabled={isPending}
                  className="rounded-lg bg-[#F87171] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#EF4444] disabled:opacity-50"
                >
                  {isPending ? t("indexDeleting") : t("indexDelete")}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
