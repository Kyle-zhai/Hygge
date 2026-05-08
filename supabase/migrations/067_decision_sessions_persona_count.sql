-- Migration 067: decision_sessions.persona_count
-- Lets the user pick how many personas join a decision discussion.
-- Default 10 — wider panel beats the previous 3–6 for surfacing diverse
-- viewpoints on real decisions. Range 3–25; pool has 101 active personas
-- so even the upper bound has selection room.

alter table decision_sessions
  add column if not exists persona_count int not null default 10
  check (persona_count between 3 and 25);

comment on column decision_sessions.persona_count is
  'Target persona count for the panel discussing this session''s decision. User-set at session creation; the picker LLM aims for this count and the clamp in pickPersonasForBrief honours it. Lower bound 3 (need a panel for a debate to be meaningful), upper bound 25 (mechanism prompts and round-table turn-taking degrade past this).';
