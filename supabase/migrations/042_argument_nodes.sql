-- 042_argument_nodes.sql
--
-- Per-message argumentation graph node for Phase 2 round-table debates.
-- Each row is one persona utterance, with attack/support edges to earlier
-- nodes. Powers two derived signals injected into next-round prompts:
--   1) un-responded claims (no incoming attack edges)
--   2) attack cycles (persona A and persona B both attack each other across rounds)
--
-- Node ID format: "r{round}:{persona_id}" (one node per persona per round).

CREATE TABLE IF NOT EXISTS public.argument_nodes (
  id TEXT PRIMARY KEY,
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  round SMALLINT NOT NULL CHECK (round BETWEEN 1 AND 3),
  speaker TEXT NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  claim TEXT NOT NULL,
  attacks JSONB NOT NULL DEFAULT '[]',
  supports JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_argument_nodes_eval
  ON public.argument_nodes (evaluation_id, round);
CREATE INDEX IF NOT EXISTS idx_argument_nodes_speaker
  ON public.argument_nodes (speaker);

ALTER TABLE public.argument_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own argument nodes"
  ON public.argument_nodes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.evaluations e
      JOIN public.projects p ON p.id = e.project_id
      WHERE e.id = argument_nodes.evaluation_id
        AND p.user_id = auth.uid()
    )
  );
