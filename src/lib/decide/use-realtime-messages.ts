"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DecisionMessage } from "./types";

// Subscribes to decision_messages for a session and ALSO polls every
// few seconds as a fallback — Supabase Realtime can silently drop
// inserts when the publication's RLS check is mis-configured or when
// the WS link has hiccups, so we don't trust it as the only source.
// Reconciles by id, dedupes naturally, keeps one ephemeral message
// (agent_thinking) at most so progress text doesn't pile up.

const POLL_INTERVAL_MS = 4_000;

export function useRealtimeMessages(sessionId: string | null) {
  const [messages, setMessages] = useState<DecisionMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [prevSessionId, setPrevSessionId] = useState<string | null>(sessionId);
  const seenIds = useRef<Set<string>>(new Set());

  // Reset state during render when sessionId changes — React 19 pattern.
  // Doing this in useEffect would trigger the set-state-in-effect lint
  // rule. Refs get reset inside the effect (project rule forbids ref
  // mutation during render).
  if (prevSessionId !== sessionId) {
    setPrevSessionId(sessionId);
    setMessages([]);
    setLoading(sessionId !== null);
  }

  // Stable function to merge new fetch results into state. Skips already-
  // seen ids and collapses old ephemerals.
  const ingest = useCallback((list: DecisionMessage[]) => {
    let added = false;
    for (const m of list) {
      if (!seenIds.current.has(m.id)) {
        seenIds.current.add(m.id);
        added = true;
      }
    }
    if (!added) return;
    setMessages((prev) => {
      const byId = new Map<string, DecisionMessage>();
      for (const m of prev) byId.set(m.id, m);
      for (const m of list) byId.set(m.id, m);
      const merged = Array.from(byId.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      return stripStaleEphemerals(merged);
    });
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    seenIds.current = new Set();

    async function fetchAll() {
      try {
        const r = await fetch(`/api/decisions/${sessionId}/messages`);
        if (!r.ok) return;
        const data = (await r.json()) as { messages: DecisionMessage[] };
        if (cancelled) return;
        ingest(data.messages ?? []);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    // Initial fetch; surfaces existing history immediately.
    void fetchAll();

    // Poll loop as Realtime fallback. Guarantees the user sees agent
    // replies even if the WS subscription drops silently.
    const pollHandle = window.setInterval(fetchAll, POLL_INTERVAL_MS);

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
          ingest([m]);
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
      window.clearInterval(pollHandle);
      void supabase.removeChannel(channel);
    };
  }, [sessionId, ingest]);

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
