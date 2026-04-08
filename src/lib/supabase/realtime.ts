import { createClient } from "./client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function subscribeToEvaluation(
  evaluationId: string,
  callbacks: {
    onStatusChange: (status: string) => void;
    onNewReview: (review: { persona_id: string }) => void;
  }
): RealtimeChannel {
  const supabase = createClient();

  const channel = supabase
    .channel(`evaluation-${evaluationId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "evaluations",
        filter: `id=eq.${evaluationId}`,
      },
      (payload) => {
        callbacks.onStatusChange(payload.new.status);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "persona_reviews",
        filter: `evaluation_id=eq.${evaluationId}`,
      },
      (payload) => {
        callbacks.onNewReview({ persona_id: payload.new.persona_id });
      }
    )
    .subscribe();

  return channel;
}

export function unsubscribe(channel: RealtimeChannel) {
  const supabase = createClient();
  supabase.removeChannel(channel);
}
