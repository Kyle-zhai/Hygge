"use client";

import type { DecisionMessage } from "@/lib/decide/types";

export function SystemNote({ message }: { message: DecisionMessage }) {
  if (!message.content) return null;
  return (
    <div className="flex justify-center">
      <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        {message.content}
      </p>
    </div>
  );
}
