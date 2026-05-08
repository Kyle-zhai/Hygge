"use client";

// New decision — minimal, centered, ChatGPT/Claude-style entry surface.
// One textarea owns the page; submit is a small icon button anchored to
// the textarea's bottom-right. Example prompts are quiet text links, not
// chip buttons. Mechanism panel sits as a thin metadata footer that says
// "this isn't ChatGPT" without overpowering the input.

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUp, Loader2, Paperclip, X } from "lucide-react";
import {
  ALL_MECHANISMS_LIST,
  MECHANISM_LABELS_EN,
  MECHANISM_LABELS_ZH,
} from "@/lib/decide/types";
import { createDecisionSession } from "@/lib/decide/use-decision-session";

const ACCEPT_TYPES =
  ".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.txt,.md,.markdown,.csv";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export default function NewDecisionPage() {
  const t = useTranslations("decide");
  const locale = useLocale();
  const router = useRouter();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const labels = locale === "zh" ? MECHANISM_LABELS_ZH : MECHANISM_LABELS_EN;
  const examples = [
    t("examplePromptShipFeature"),
    t("examplePromptHire"),
    t("examplePromptPivot"),
    t("examplePromptBuildBuy"),
  ];

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    if (incoming.length === 0) return;
    const oversized = incoming.find((f) => f.size > MAX_FILE_BYTES);
    if (oversized) {
      setError(t("fileTooLarge", { name: oversized.name }));
      e.target.value = "";
      return;
    }
    setFiles((prev) => {
      const byKey = new Map(prev.map((f) => [`${f.name}:${f.size}`, f]));
      for (const f of incoming) byKey.set(`${f.name}:${f.size}`, f);
      return Array.from(byKey.values());
    });
    setError(null);
    e.target.value = "";
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    if ((!text.trim() && files.length === 0) || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await createDecisionSession();
      let res: Response;
      if (files.length > 0) {
        const fd = new FormData();
        fd.set("kind", "user_text");
        fd.set("content", text.trim());
        for (const f of files) fd.append("files", f);
        res = await fetch(`/api/decisions/${session.id}/messages`, {
          method: "POST",
          body: fd,
        });
      } else {
        res = await fetch(`/api/decisions/${session.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "user_text", content: text.trim() }),
        });
      }
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

  const canSend = (!!text.trim() || files.length > 0) && !submitting;

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

      {/* Attached files chip row */}
      {files.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}:${f.size}:${i}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground"
            >
              <Paperclip className="size-3" aria-hidden="true" />
              <span className="max-w-[220px] truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                disabled={submitting}
                aria-label={t("removeAttachment")}
                className="ml-1 inline-flex size-3.5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-2.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative rounded-2xl border border-border bg-background shadow-sm transition-colors focus-within:border-foreground/40">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("newDecisionPlaceholder")}
          disabled={submitting}
          rows={6}
          className="block w-full resize-none rounded-2xl border-0 bg-transparent px-5 py-4 pb-14 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 disabled:opacity-60"
        />
        {/* Bottom action row inside the textarea container — paperclip
            on the left, send button on the right (ChatGPT pattern). */}
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            aria-label={t("attachFile")}
            title={t("attachFile")}
            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Paperclip className="size-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT_TYPES}
            onChange={onFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSend}
            aria-label={t("startAnalysis")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-25 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </button>
        </div>
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
