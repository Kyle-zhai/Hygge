"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DecisionMessage } from "./types";

// Subscribes to decision_messages for a session. Reconciles by id and
// keeps a single ephemeral (agent_thinking) message at most — newer
// ephemeral arrivals replace older ones, so the chat doesn't fill up
// with progress text.

export function useRealtimeMessages(sessionId: string | null) {
  const [messages, setMessages] = useState<DecisionMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [prevSessionId, setPrevSessionId] = useState<string | null>(sessionId);
  const seenIds = useRef<Set<string>>(new Set());

  // Reset state during render when sessionId changes — React 19 pattern.
  // Doing this in useEffect would trigger the set-state-in-effect lint
  // rule and cause an extra render pass. Refs get reset inside the
  // effect (project rule forbids ref mutation during render).
  if (prevSessionId !== sessionId) {
    setPrevSessionId(sessionId);
    setMessages([]);
    setLoading(sessionId !== null);
  }

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    seenIds.current = new Set();

    // Initial fetch through the API (handles auth + RLS via cookie)
    fetch(`/api/decisions/${sessionId}/messages`)
      .then((r) => r.json())
      .then((data: { messages: DecisionMessage[] }) => {
        if (cancelled) return;
        const list = data.messages ?? [];
        for (const m of list) seenIds.current.add(m.id);
        setMessages(stripStaleEphemerals(list));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    const supabase = createClient();
    const channel = supabase
      .channel(`decision-messages-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "decision_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const m = payload.new as DecisionMessage;
          if (seenIds.current.has(m.id)) return;
          seenIds.current.add(m.id);
          setMessages((prev) => stripStaleEphemerals([...prev, m]));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "decision_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const old = payload.old as { id?: string };
          if (!old.id) return;
          seenIds.current.delete(old.id);
          setMessages((prev) => prev.filter((x) => x.id !== old.id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return { messages, loading };
}

// Keeps only the most recent ephemeral message; older ephemerals drop out
// of the rendered list. Non-ephemeral messages are untouched.
function stripStaleEphemerals(list: DecisionMessage[]): DecisionMessage[] {
  let lastEphemeralIdx = -1;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].is_ephemeral) {
      lastEphemeralIdx = i;
      break;
    }
  }
  if (lastEphemeralIdx === -1) return list;
  return list.filter((m, i) => !m.is_ephemeral || i === lastEphemeralIdx);
}
