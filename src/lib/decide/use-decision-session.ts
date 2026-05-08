"use client";

import { useCallback } from "react";
import type { MessageKind } from "./types";

// Mutation helpers for the chat thread. Posting a message creates the
// decision_messages row server-side AND enqueues an intake job. The
// useRealtimeMessages hook on the page renders the new message via
// Supabase Realtime + a polling fallback; nothing here calls setState.

export function useDecisionSession(sessionId: string) {
  const sendUserText = useCallback(
    async (text: string, files: File[] = []) => {
      await postMessage(sessionId, "user_text", text, files);
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
  files: File[] = [],
): Promise<void> {
  // Multipart when files are attached so the API can parse them
  // server-side; JSON otherwise (cheaper and matches the existing
  // option-pick + skip-run paths).
  let res: Response;
  if (files.length > 0) {
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("content", content);
    for (const f of files) fd.append("files", f);
    res = await fetch(`/api/decisions/${sessionId}/messages`, {
      method: "POST",
      body: fd,
    });
  } else {
    res = await fetch(`/api/decisions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, content }),
    });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `POST /api/decisions/${sessionId}/messages failed: ${res.status}`);
  }
}

export async function createDecisionSession(
  locale: "en" | "zh" = "en",
): Promise<{ id: string }> {
  const res = await fetch("/api/decisions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
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
