"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { DecisionMessage } from "@/lib/decide/types";
import { UserBubble } from "./user-bubble";
import { QuestionCard } from "./question-card";
import { ConfirmationCard } from "./confirmation-card";
import { ThinkingBubble } from "./thinking-bubble";
import { ArtifactPreviewCard } from "./artifact-preview-card";
import { SystemNote } from "./system-note";

interface Props {
  sessionId: string;
  messages: DecisionMessage[];
  loading: boolean;
  onAnswerOption: (messageId: string, optionId: string) => void;
  onAnswerText: (text: string) => void;
  onSkipRunNow: () => void;
}

const STICK_TO_BOTTOM_THRESHOLD_PX = 96;

export function ChatThread({
  sessionId,
  messages,
  loading,
  onAnswerOption,
  onAnswerText,
  onSkipRunNow,
}: Props) {
  const t = useTranslations("decide");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Track whether the user is parked near the bottom; if they scrolled up
  // to read older messages, don't yank them back when streaming arrives.
  const stickToBottomRef = useRef(true);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < STICK_TO_BOTTOM_THRESHOLD_PX;
  }

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto"
    >
      {/* Single centered column — wider than the old 3xl so user
          bubbles don't sit at an awkward middle-of-page right edge.
          Matches the conversation widths Claude.ai / ChatGPT settle on
          for the read flow. */}
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-6 py-8">
      {messages.map((m) => {
        switch (m.kind) {
          case "user_text":
          case "user_option":
          case "user_skip_run":
            return <UserBubble key={m.id} message={m} allMessages={messages} />;
          case "agent_question":
            return (
              <QuestionCard
                key={m.id}
                message={m}
                onAnswerOption={(optionId) => onAnswerOption(m.id, optionId)}
                onAnswerText={onAnswerText}
                onSkipRunNow={onSkipRunNow}
              />
            );
          case "agent_confirmation":
            return (
              <ConfirmationCard
                key={m.id}
                message={m}
                onAnswerOption={(optionId) => onAnswerOption(m.id, optionId)}
              />
            );
          case "agent_thinking":
            return <ThinkingBubble key={m.id} message={m} />;
          case "agent_artifact":
            return m.brief_id ? (
              <ArtifactPreviewCard
                key={m.id}
                sessionId={sessionId}
                briefId={m.brief_id}
              />
            ) : null;
          case "system":
            return <SystemNote key={m.id} message={m} />;
          default:
            return null;
        }
      })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
