-- 043_persona_tom_states.sql
--
-- Per-observer Theory-of-Mind snapshot per round in a round-table debate.
-- Each row records, for one observer persona at the END of one round, what
-- they believed every OTHER persona was thinking (their belief + their
-- unstated assumption + observer's confidence). The next round's prompt
-- shows the observer their prior reads alongside the actual positions
-- targets ended up taking — so the observer can name explicit ToM gaps
-- ("I thought you assumed X, but your last point shows you actually
-- believe Y").
--
-- Design fold: this is a single-call ToM (no extra LLM round-trip per
-- persona — the entries are emitted as a JSON field inside the existing
-- per-round response). The "decompose" step lives in the prompt schema
-- itself: the model is asked to fill out (about, belief, assumption,
-- confidence) for each other persona, which reproduces the perspective-
-- taking + question-reframing structure of SimToM/Decompose-ToM without
-- the +N call cost.
--
-- Address shape: (evaluation_id, observer_persona_id, round_number)
--   round_number = 1  -> ToM produced AFTER round 1 messages parsed
--   round_number = 2  -> ToM produced AFTER round 2 messages parsed
--   round_number = 3  -> ToM produced AFTER round 3 messages parsed

CREATE TABLE IF NOT EXISTS public.persona_tom_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  observer_persona_id TEXT NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  round_number SMALLINT NOT NULL CHECK (round_number BETWEEN 1 AND 3),

  -- entries: array of ToMEntry objects
  --   { about_persona_id, i_think_they_believe, their_unstated_assumption, my_confidence_in_this_read }
  -- Length is bounded by the number of other personas in the debate (≤5).
  entries JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (evaluation_id, observer_persona_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_tom_states_eval
  ON public.persona_tom_states (evaluation_id, round_number);
CREATE INDEX IF NOT EXISTS idx_tom_states_observer
  ON public.persona_tom_states (observer_persona_id, round_number);

ALTER TABLE public.persona_tom_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ToM states"
  ON public.persona_tom_states
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.evaluations e
      JOIN public.projects p ON p.id = e.project_id
      WHERE e.id = persona_tom_states.evaluation_id
        AND p.user_id = auth.uid()
    )
  );
