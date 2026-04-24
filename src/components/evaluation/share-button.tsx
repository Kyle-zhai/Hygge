"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Check, Copy, Link2, Loader2, Share2, Trash2 } from "lucide-react";

interface ShareButtonProps {
  evaluationId: string;
}

type ShareState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; token: string }
  | { status: "error"; message: string };

export function ShareButton({ evaluationId }: ShareButtonProps) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ShareState>({ status: "idle" });
  const [copied, setCopied] = useState(false);

  const L = (zh: string, en: string) => (locale === "zh" ? zh : en);

  async function openDialog() {
    setOpen(true);
    if (state.status === "ready") return;
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/evaluations/${evaluationId}/share`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create share link");
      setState({ status: "ready", token: body.token });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  async function revoke() {
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/evaluations/${evaluationId}/share`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to revoke");
      }
      setState({ status: "idle" });
      setOpen(false);
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  function shareUrl(token: string): string {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/${locale}/share/${token}`;
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers — select and prompt the user
      window.prompt(L("复制链接：", "Copy link:"), url);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-3.5 py-1.5 text-xs font-medium text-[color:var(--accent-warm)] transition-colors hover:border-[rgb(var(--accent-warm-rgb)/0.40)] hover:bg-[rgb(var(--accent-warm-rgb)/0.05)]"
      >
        <Share2 className="h-3.5 w-3.5" />
        {L("分享", "Share")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-6 shadow-xl"
          >
            <div className="flex items-center gap-2 mb-1">
              <Link2 className="h-4 w-4 text-[color:var(--accent-warm)]" />
              <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">
                {L("分享这份评估", "Share this evaluation")}
              </h3>
            </div>
            <p className="text-xs text-[color:var(--text-secondary)] mb-4">
              {L(
                "任何持有此链接的人都可以查看报告，无需登录。你可以随时撤销。",
                "Anyone with this link can view the report without signing in. You can revoke it anytime.",
              )}
            </p>

            {state.status === "loading" && (
              <div className="flex items-center gap-2 py-6 justify-center text-xs text-[color:var(--text-secondary)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                {L("正在处理...", "Working...")}
              </div>
            )}

            {state.status === "ready" && (
              <>
                <div className="flex items-stretch gap-2 mb-3">
                  <input
                    readOnly
                    value={shareUrl(state.token)}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-0 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-3 py-2 text-xs text-[color:var(--text-primary)] focus:outline-none focus:border-[rgb(var(--accent-warm-rgb)/0.40)]"
                  />
                  <button
                    type="button"
                    onClick={() => copyUrl(shareUrl(state.token))}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--accent-warm)] px-3 py-2 text-xs font-medium text-[color:var(--bg-primary)] hover:bg-[color:var(--accent-warm-hover)]"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? L("已复制", "Copied") : L("复制", "Copy")}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={revoke}
                    className="inline-flex items-center gap-1.5 text-xs text-[color:var(--text-secondary)] hover:text-[#EF4444] transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {L("撤销链接", "Revoke link")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-xs text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
                  >
                    {L("关闭", "Close")}
                  </button>
                </div>
              </>
            )}

            {state.status === "error" && (
              <div className="text-xs text-[#EF4444] py-4">{state.message}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
