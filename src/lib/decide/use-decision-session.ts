"use client";

import { useCallback } from "react";
import type { MessageKind } from "./types";

// Mutation helpers for the chat thread. Posting a message creates the
// decision_messages row server-side AND enqueues an intake job. The
// useRealtimeMessages hook on the page renders the new message via
// Supabase Realtime; nothing here calls setState.

export function useDecisionSession(sessionId: string) {
  const sendUserText = useCallback(
    async (text: string) => {
      await postMessage(sessionId, "user_text", text);
    },
    [sessionId],
  );

  const sendUserOption = useCallback(
    async (optionId: string) => {
      await postMessage(sessionId, "user_option", optionId);
    },
    [sessionId],
  );

  const skipRunNow = useCallback(async () => {
    await postMessage(sessionId, "user_skip_run", "");
  }, [sessionId]);

  return { sendUserText, sendUserOption, skipRunNow };
}

async function postMessage(
  sessionId: string,
  kind: Extract<MessageKind, "user_text" | "user_option" | "user_skip_run">,
  content: string,
): Promise<void> {
  const res = await fetch(`/api/decisions/${sessionId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, content }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `POST /api/decisions/${sessionId}/messages failed: ${res.status}`);
  }
}

export async function createDecisionSession(): Promise<{ id: string }> {
  const res = await fetch("/api/decisions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
  const data = (await res.json()) as { session: { id: string } };
  return data.session;
}

export async function rerunBrief(
  briefId: string,
  delta: {
    remove_dimensions?: string[];
    drop_mechanisms?: string[];
    swap_personas?: boolean;
    note?: string;
  } = {},
): Promise<{ brief_id: string }> {
  const res = await fetch(`/api/decisions/briefs/${briefId}/rerun`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delta }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Rerun failed: ${res.status}`);
  }
  return res.json();
}
