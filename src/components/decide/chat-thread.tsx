"use client";

import { useEffect, useRef } from "react";
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

export function ChatThread({
  sessionId,
  messages,
  loading,
  onAnswerOption,
  onAnswerText,
  onSkipRunNow,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading conversation...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-6">
      {messages.map((m) => {
        switch (m.kind) {
          case "user_text":
          case "user_option":
          case "user_skip_run":
            return <UserBubble key={m.id} message={m} />;
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
  );
}
