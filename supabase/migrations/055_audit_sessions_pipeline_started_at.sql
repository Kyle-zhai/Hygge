-- 055_audit_sessions_pipeline_started_at.sql
--
-- Stuck-running session self-healing. The multi-agent audit pipeline (migrations
-- 049-053) flips audit_sessions.status to 'running' when the worker picks up
-- the job. If the worker dies mid-run (Railway restart, OOM, Tavily timeout),
-- the row is permanently stuck in 'running' — the /run route now blocks
-- duplicate enqueues on running status, so the user has no recovery path.
--
-- This migration adds pipeline_started_at so a watchdog cron can sweep stale
-- running sessions and flip them to 'failed', and so the /run route can
-- bypass the duplicate-job guard once the running row is provably stale.

set client_min_messages to warning;

alter table public.audit_sessions
  add column if not exists pipeline_started_at timestamptz;

-- Composite index so the sweep cron can scan stale running rows in one seek.
create index if not exists audit_sessions_status_started_idx
  on public.audit_sessions (status, pipeline_started_at)
  where status = 'running';
