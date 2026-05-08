"use client";

// New decision — minimal, centered, ChatGPT/Claude-style entry surface.
// One textarea owns the page; submit is a small icon button anchored to
// the textarea's bottom-right. Example prompts are quiet text links, not
// chip buttons. Mechanism panel sits as a thin metadata footer that says
// "this isn't ChatGPT" without overpowering the input.

import { useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUp, Loader2 } from "lucide-react";
import {
  ALL_MECHANISMS_LIST,
  MECHANISM_LABELS_EN,
  MECHANISM_LABELS_ZH,
} from "@/lib/decide/types";
import { createDecisionSession } from "@/lib/decide/use-decision-session";

export default function NewDecisionPage() {
  const t = useTranslations("decide");
  const locale = useLocale();
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labels = locale === "zh" ? MECHANISM_LABELS_ZH : MECHANISM_LABELS_EN;
  const examples = [
    t("examplePromptShipFeature"),
    t("examplePromptHire"),
    t("examplePromptPivot"),
    t("examplePromptBuildBuy"),
  ];

  async function submit() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await createDecisionSession();
      const res = await fetch(`/api/decisions/${session.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "user_text", content: text.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.push(`/${locale}/decide/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  // Cmd/Ctrl + Enter sends; plain Enter inserts a newline (matches the
  // ChatGPT convention for multi-line decision questions). IME guard
  // keeps pinyin candidates from auto-submitting.
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    if (e.nativeEvent.isComposing) return;
    if (!(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    void submit();
  }

  const canSend = !!text.trim() && !submitting;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-2xl flex-col px-6 pt-20 pb-12">
      <header className="mb-10">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
          {t("newDecisionTitle")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("newDecisionSubtitle")}
        </p>
      </header>

      <div className="relative">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("newDecisionPlaceholder")}
          disabled={submitting}
          rows={6}
          className="block w-full resize-none rounded-2xl border border-border bg-background px-5 py-4 pr-14 text-base leading-relaxed text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/40 focus:outline-none focus:ring-0 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label={t("startAnalysis")}
          className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-25 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      {/* Quiet example-prompt list — no chip buttons, just text links */}
      <section className="mt-8">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
          {t("tryThis")}
        </p>
        <ul className="space-y-1.5">
          {examples.map((example) => (
            <li key={example}>
              <button
                type="button"
                onClick={() => setText(example)}
                disabled={submitting}
                className="text-left text-sm leading-relaxed text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed"
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Bottom metadata: minimalist mechanism preview as a single
          subtle row. No icons, no chips — just text the way OpenAI's
          model picker reads as "what's running" without commanding
          attention. */}
      <footer className="mt-auto pt-12">
        <div className="border-t border-border/60 pt-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
            {t("panelPreviewLabel")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {ALL_MECHANISMS_LIST.map((k) => labels[k]).join(" · ")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70">
            {t("panelPreviewMechanisms")} · {t("panelPreviewPersonas")}
          </p>
        </div>
      </footer>
    </main>
  );
}
