"use client";

// Chat thread page — the heart of /decide. Subscribes to decision_messages
// via Realtime and renders ChatThread + ChatComposer.

import { use } from "react";
import { ChatThread } from "@/components/decide/chat-thread";
import { ChatComposer } from "@/components/decide/chat-composer";
import { useRealtimeMessages } from "@/lib/decide/use-realtime-messages";
import { useDecisionSession } from "@/lib/decide/use-decision-session";

export default function DecisionThreadPage({
  params,
}: {
  params: Promise<{ sessionId: string; locale: string }>;
}) {
  const { sessionId } = use(params);
  const { messages, loading } = useRealtimeMessages(sessionId);
  const { sendUserText, sendUserOption, skipRunNow } = useDecisionSession(sessionId);

  // Disable composer while the agent is awaiting an answer through buttons
  // (a question card or confirmation card is the latest agent message).
  const lastAgent = [...messages].reverse().find((m) =>
    m.kind === "agent_question" || m.kind === "agent_confirmation",
  );
  const lastUser = [...messages].reverse().find((m) =>
    m.kind === "user_text" || m.kind === "user_option" || m.kind === "user_skip_run",
  );
  const composerDisabled = Boolean(
    lastAgent && (!lastUser || new Date(lastUser.created_at) < new Date(lastAgent.created_at)),
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex-1 overflow-hidden">
        <ChatThread
          sessionId={sessionId}
          messages={messages}
          loading={loading}
          onAnswerOption={(_messageId, optionId) => void sendUserOption(optionId)}
          onAnswerText={(text) => void sendUserText(text)}
          onSkipRunNow={() => void skipRunNow()}
        />
      </div>
      <ChatComposer
        disabled={composerDisabled}
        onSend={(text) => sendUserText(text)}
      />
    </div>
  );
}
