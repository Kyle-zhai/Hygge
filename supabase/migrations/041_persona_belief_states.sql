-- 041_persona_belief_states.sql
--
-- Per-persona structured belief snapshot per round in a round-table debate.
-- Powers Phase 2 of the debate-realism moat: personas now carry forward an
-- explicit position/confidence + evidence ledger across rounds, so their
-- next-round reasoning is conditioned on what shifted them — not just on a
-- raw transcript.
--
-- Address shape: (evaluation_id, persona_id, round_number)
--   round_number = 0  -> derived from initial persona_review (no LLM call)
--   round_number = 1  -> snapshot AFTER round 1 messages parsed
--   round_number = 2  -> snapshot AFTER round 2 messages parsed
--   round_number = 3  -> snapshot AFTER round 3 messages parsed
--
-- This table is read-only from the user's POV — populated by the worker. RLS
-- gates SELECT on the same evaluations -> projects.user_id chain used by the
-- existing summary_reports tables.

CREATE TABLE IF NOT EXISTS public.persona_belief_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  round_number SMALLINT NOT NULL CHECK (round_number BETWEEN 0 AND 3),

  -- position: -1 (strongly against the topic_focus) ... +1 (strongly for)
  position NUMERIC(4, 3) NOT NULL CHECK (position >= -1 AND position <= 1),
  -- confidence: 0 (totally unsure) ... 1 (locked in)
  confidence NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

  -- key_evidence: array of { source, weight, content, from_speaker?, from_round? }
  key_evidence JSONB NOT NULL DEFAULT '[]',
  -- considered_alternatives: short strings describing positions persona considered but rejected
  considered_alternatives JSONB NOT NULL DEFAULT '[]',
  -- shifts_this_round: array of { caused_by, claim, delta_position, delta_confidence }
  -- Empty for round_number = 0 (initial state has no shifts).
  shifts_this_round JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (evaluation_id, persona_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_belief_states_eval
  ON public.persona_belief_states (evaluation_id, round_number);
CREATE INDEX IF NOT EXISTS idx_belief_states_persona
  ON public.persona_belief_states (persona_id, round_number);

ALTER TABLE public.persona_belief_states ENABLE ROW LEVEL SECURITY;

-- Read access: user can see belief snapshots for evaluations on their own projects.
-- Mirrors the ownership chain used by summary_reports / persona_reviews.
CREATE POLICY "Users can view own belief states"
  ON public.persona_belief_states
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.evaluations e
      JOIN public.projects p ON p.id = e.project_id
      WHERE e.id = persona_belief_states.evaluation_id
        AND p.user_id = auth.uid()
    )
  );

-- Writes happen via the service-role worker only — no INSERT/UPDATE/DELETE
-- policies are intentionally defined for the authenticated role. The service
-- role bypasses RLS, so the worker can write freely; clients cannot.
