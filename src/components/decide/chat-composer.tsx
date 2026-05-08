"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  disabled?: boolean;
  onSend: (text: string) => void | Promise<void>;
}

export function ChatComposer({ disabled, onSend }: Props) {
  const t = useTranslations("decide");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || submitting || disabled) return;
    setSubmitting(true);
    try {
      await onSend(text.trim());
      setText("");
    } finally {
      setSubmitting(false);
    }
  }

  // IME composition guard: pinyin / Japanese / Korean composition ends
  // with an Enter that React reports as keyDown. Don't submit while a
  // composition is in flight or we'll send half-typed candidates.
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;
    e.preventDefault();
    void submit(e as unknown as FormEvent);
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-end gap-2 border-t bg-background p-4"
    >
      <textarea
        className="flex-1 resize-none rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("composerPlaceholder")}
        disabled={disabled || submitting}
        onKeyDown={onKeyDown}
      />
      <Button type="submit" disabled={disabled || submitting || !text.trim()}>
        {submitting ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="size-4 animate-spin" />
            {t("sending")}
          </span>
        ) : (
          t("send")
        )}
      </Button>
    </form>
  );
}
