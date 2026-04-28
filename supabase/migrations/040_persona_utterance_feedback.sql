-- 040_persona_utterance_feedback.sql

CREATE TABLE IF NOT EXISTS public.persona_utterance_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Utterance address. Exactly one of these two patterns is populated:
  --   Round-table:  evaluation_id + round_number + message_index, debate_message_id IS NULL
  --   1v1 debate:   debate_message_id, evaluation_id IS NULL
  evaluation_id UUID REFERENCES public.evaluations(id) ON DELETE CASCADE,
  round_number SMALLINT,
  message_index SMALLINT,
  debate_message_id UUID REFERENCES public.debate_messages(id) ON DELETE CASCADE,

  -- Denormalized for analytics — the persona this utterance belongs to
  persona_id TEXT NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,

  rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  comment TEXT CHECK (comment IS NULL OR length(comment) <= 280),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT utterance_address_xor CHECK (
    (evaluation_id IS NOT NULL AND round_number IS NOT NULL AND message_index IS NOT NULL AND debate_message_id IS NULL)
    OR
    (debate_message_id IS NOT NULL AND evaluation_id IS NULL AND round_number IS NULL AND message_index IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_round_table_unique
  ON public.persona_utterance_feedback (user_id, evaluation_id, round_number, message_index)
  WHERE evaluation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_1v1_unique
  ON public.persona_utterance_feedback (user_id, debate_message_id)
  WHERE debate_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_persona_rating ON public.persona_utterance_feedback (persona_id, rating);

ALTER TABLE public.persona_utterance_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback"
  ON public.persona_utterance_feedback
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own feedback"
  ON public.persona_utterance_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own feedback"
  ON public.persona_utterance_feedback
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own feedback"
  ON public.persona_utterance_feedback
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at_persona_utterance_feedback()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_updated_at_persona_utterance_feedback
  BEFORE UPDATE ON public.persona_utterance_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_persona_utterance_feedback();
