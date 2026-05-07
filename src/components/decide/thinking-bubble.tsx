"use client";

import type { DecisionMessage } from "@/lib/decide/types";

export function ThinkingBubble({ message }: { message: DecisionMessage }) {
  return (
    <div className="flex justify-start">
      <div className="flex max-w-[80%] items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-sm text-muted-foreground">
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
        </span>
        <span className="italic">{message.content ?? "正在思考..."}</span>
      </div>
    </div>
  );
}
