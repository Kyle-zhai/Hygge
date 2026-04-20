import { createClient } from "./client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface ReviewPayload {
  persona_id: string;
  review_text: string;
  scores: Record<string, number | string>;
  strengths: string[];
  weaknesses: string[];
}

export function subscribeToEvaluation(
  evaluationId: string,
  callbacks: {
    onStatusChange: (status: string, errorMessage: string | null) => void;
    onNewReview: (review: ReviewPayload) => void;
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
        callbacks.onStatusChange(
          payload.new.status,
          payload.new.error_message ?? null,
        );
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
      async (payload) => {
        const personaId = payload.new.persona_id;
        try {
          const { data, error } = await supabase
            .from("persona_reviews")
            .select("persona_id, review_text, scores, strengths, weaknesses")
            .eq("evaluation_id", evaluationId)
            .eq("persona_id", personaId)
            .maybeSingle();

          if (error) {
            console.error(
              "[realtime] failed to fetch review row",
              { evaluationId, personaId, error: error.message },
            );
            return;
          }
          if (data) {
            callbacks.onNewReview(data as ReviewPayload);
          }
        } catch (err) {
          console.error(
            "[realtime] unexpected error in review fetch",
            { evaluationId, personaId, err },
          );
        }
      }
    )
    .subscribe();

  return channel;
}

export function unsubscribe(channel: RealtimeChannel) {
  const supabase = createClient();
  supabase.removeChannel(channel);
}
