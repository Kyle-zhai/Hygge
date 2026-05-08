"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  resolveOptionLabel,
  type DecisionMessage,
  type QuestionOption,
} from "@/lib/decide/types";
import { cn } from "@/lib/utils";

interface Props {
  message: DecisionMessage;
  /**
   * The full session message list so we can resolve a user_option payload
   * (which stores only the option id) back to its human-readable label by
   * walking back to the most recent agent_question/agent_confirmation.
   */
  allMessages: DecisionMessage[];
}

export function UserBubble({ message, allMessages }: Props) {
  const t = useTranslations("decide");
  const locale = useLocale() === "zh" ? "zh" : "en";

  let body: string = message.content ?? "";
  if (message.kind === "user_skip_run") {
    body = t("userSkipRun");
  } else if (message.kind === "user_option") {
    const optionId = message.content ?? "";
    const dbLabel = lookupOptionLabel(message, optionId, allMessages);
    const finalLabel = resolveOptionLabel(optionId, dbLabel ?? optionId, locale);
    body = `${t("youPicked")} ${finalLabel}`;
  }

  return (
    <div className="flex justify-end">
      <div
        className={cn(
          "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm text-primary-foreground",
          message.kind === "user_option" && "italic opacity-80",
        )}
      >
        {body}
      </div>
    </div>
  );
}

function lookupOptionLabel(
  pickMessage: DecisionMessage,
  optionId: string,
  allMessages: DecisionMessage[],
): string | null {
  const pickAt = new Date(pickMessage.created_at).getTime();
  // Walk back through prior agent prompts. The most-recent question is
  // not always the one being answered (a user can answer an earlier
  // question after time has passed) — keep looking until we find a
  // matching option id, or run out of candidates.
  for (let i = allMessages.length - 1; i >= 0; i--) {
    const m = allMessages[i];
    if (m.kind !== "agent_question" && m.kind !== "agent_confirmation") continue;
    if (new Date(m.created_at).getTime() >= pickAt) continue;
    const opts = (m.options ?? []) as QuestionOption[];
    const found = opts.find((o) => o.id === optionId);
    if (found) return found.label;
    // No match in this candidate — keep searching older ones.
  }
  return null;
}
