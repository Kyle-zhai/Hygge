-- Migration 064: harden decision_mechanism_runs against retry races.
-- Closes a TOCTOU window in the orchestrator where two concurrent
-- 'orchestrate' jobs (BullMQ retry, manual re-enqueue) could both pass
-- the existingKinds check and insert duplicate runs for the same
-- (brief_id, kind) pair. The unique index makes the second insert fail
-- so retry logic can fall back to the existing row safely.

create unique index if not exists decision_mechanism_runs_brief_kind_idx
  on public.decision_mechanism_runs (brief_id, kind);

comment on index public.decision_mechanism_runs_brief_kind_idx is
  'One mechanism run per kind per brief — prevents orchestrator/retry races (added 2026-05-07 in /review hardening pass).';
