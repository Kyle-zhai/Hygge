-- Migration 066: decision_sessions.locale
-- Tracks the page locale at session-creation time so the worker can emit
-- ephemeral status messages and confirmation prose in the user's chosen
-- locale. Distinct from "language detected from user input" — the latter
-- drives LLM-generated long-form (mechanism reports, persona reviews) and
-- can be overridden by an explicit instruction in the user's message.

alter table decision_sessions
  add column if not exists locale text not null default 'en'
  check (locale in ('en','zh'));

comment on column decision_sessions.locale is
  'Page locale captured at session creation. Used by the worker to render UI-chrome messages (agent_thinking status, agent_confirmation framing) in the user''s language. LLM-generated long-form follows the language detected from the user''s message, with explicit instructions in the message itself taking precedence.';
