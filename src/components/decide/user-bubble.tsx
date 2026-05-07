"use client";

import { useTranslations } from "next-intl";
import type { DecisionMessage } from "@/lib/decide/types";
import { cn } from "@/lib/utils";

export function UserBubble({ message }: { message: DecisionMessage }) {
  const t = useTranslations("decide");

  let body: string = message.content ?? "";
  if (message.kind === "user_skip_run") {
    body = t("userSkipRun");
  } else if (message.kind === "user_option") {
    // content is the option id by convention; the label was shown in the
    // QuestionCard at click time. Render a compact "you picked X".
    body = `${t("youPicked")} ${message.content ?? ""}`;
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
