"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
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
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit(e as unknown as FormEvent);
          }
        }}
      />
      <Button type="submit" disabled={disabled || submitting || !text.trim()}>
        {submitting ? "..." : t("send")}
      </Button>
    </form>
  );
}
