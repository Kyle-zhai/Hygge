-- Migration 062: extend persona_utterance_feedback with a third address kind
-- so the training-data flywheel keeps working for utterances inside the new
-- decision-mechanism drilldown view (MechanismRunDrawer).
--
-- AGENTS.md: <UtteranceFeedbackButtons /> must render on every persona
-- utterance — this migration is what lets it actually persist a vote when
-- the utterance lives in a decision_mechanism_runs.raw_output transcript.

-- ─── 1. New columns ─────────────────────────────────────────────────
alter table public.persona_utterance_feedback
  add column if not exists decision_mechanism_run_id uuid
    references public.decision_mechanism_runs(id) on delete cascade,
  add column if not exists utterance_index smallint;

-- ─── 2. Replace XOR constraint to admit the new shape ───────────────
alter table public.persona_utterance_feedback
  drop constraint if exists utterance_address_xor;

alter table public.persona_utterance_feedback
  add constraint utterance_address_xor check (
    -- Round-table form
    (
      evaluation_id is not null
      and round_number is not null
      and message_index is not null
      and debate_message_id is null
      and decision_mechanism_run_id is null
      and utterance_index is null
    )
    or
    -- 1v1 form
    (
      debate_message_id is not null
      and evaluation_id is null
      and round_number is null
      and message_index is null
      and decision_mechanism_run_id is null
      and utterance_index is null
    )
    or
    -- Decision-mechanism form (new)
    (
      decision_mechanism_run_id is not null
      and utterance_index is not null
      and evaluation_id is null
      and round_number is null
      and message_index is null
      and debate_message_id is null
    )
  );

-- ─── 3. Unique-vote-per-utterance index for the new form ────────────
create unique index if not exists idx_feedback_decision_mechanism_unique
  on public.persona_utterance_feedback (user_id, decision_mechanism_run_id, utterance_index)
  where decision_mechanism_run_id is not null;

-- RLS policies on persona_utterance_feedback are already user-scoped
-- (auth.uid() = user_id), so they apply uniformly to the new address kind
-- without modification.

comment on column public.persona_utterance_feedback.decision_mechanism_run_id is
  'For utterances surfaced in MechanismRunDrawer — references decision_mechanism_runs.id. Set together with utterance_index.';
comment on column public.persona_utterance_feedback.utterance_index is
  '0-based index into decision_mechanism_runs.raw_output.raw_transcript[] when that is an array of utterances.';
