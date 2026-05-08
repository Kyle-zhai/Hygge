"use client";

import {
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, Loader2, Paperclip, X } from "lucide-react";

interface Props {
  disabled?: boolean;
  onSend: (text: string, files: File[]) => void | Promise<void>;
}

const ACCEPT_TYPES =
  ".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.txt,.md,.markdown,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/markdown,text/csv";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB per file

export function ChatComposer({ disabled, onSend }: Props) {
  const t = useTranslations("decide");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if ((!text.trim() && files.length === 0) || submitting || disabled) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSend(text.trim(), files);
      setText("");
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;
    e.preventDefault();
    void submit(e as unknown as FormEvent);
  }

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
    e.target.value = ""; // reset so the same file can be re-attached
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  const canSend = (!!text.trim() || files.length > 0) && !submitting && !disabled;

  return (
    <form onSubmit={submit} className="py-4">
      {/* Attached files row — chips above the input. */}
      {files.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}:${f.size}:${i}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground"
            >
              <Paperclip className="size-3" aria-hidden="true" />
              <span className="max-w-[180px] truncate">{f.name}</span>
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

      {/* Integrated input: paperclip on left, textarea, arrow on right —
          like ChatGPT / Claude composer pill. */}
      <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2.5 shadow-sm focus-within:border-foreground/40 transition-colors">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || submitting}
          aria-label={t("attachFile")}
          title={t("attachFile")}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
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
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("composerPlaceholder")}
          disabled={disabled || submitting}
          rows={1}
          className="block max-h-48 min-h-[24px] flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={t("startAnalysis")}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-25"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </form>
  );
}
