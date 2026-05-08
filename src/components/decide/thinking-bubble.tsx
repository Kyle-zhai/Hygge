"use client";

import { useTranslations } from "next-intl";
import type { DecisionMessage } from "@/lib/decide/types";

export function ThinkingBubble({ message }: { message: DecisionMessage }) {
  const t = useTranslations("decide");
  // Worker may emit empty content for a generic "thinking" tick; fall
  // back to a localized string instead of the previously-hardcoded
  // Chinese fallback that leaked into English flows.
  const text = message.content?.trim() ? message.content : t("thinking");

  return (
    <div className="flex justify-start">
      <div className="flex max-w-[80%] items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-sm text-muted-foreground">
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
        </span>
        <span className="italic">{text}</span>
      </div>
    </div>
  );
}
