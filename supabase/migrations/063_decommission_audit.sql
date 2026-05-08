-- Migration 063: decommission the audit pivot.
-- Spec: docs/superpowers/specs/2026-05-06-multi-agent-decision-tool-design.md §9.7
--
-- The 2026-04-30 audit/compliance pivot is being reversed in favor of
-- general-purpose decision analysis (see migration 061 + the new /decide
-- code paths). The audit tables are renamed to deprecated_* rather than
-- dropped, so a future migration can rescue data if anything turns out to
-- depend on it. A future migration (063+) will drop them outright once
-- the 30-day observation window has passed.

-- Defensive: guards against running this migration twice. If the original
-- table doesn't exist (already renamed), do nothing.
do $$
declare
  audit_tables text[] := array[
    'audit_sessions',
    'audit_findings',
    'audit_scoping_sessions',
    'audit_trail',
    'audit_law_catalog',
    'audit_search_cache',
    'audit_persona_pool',
    'audit_session_files',
    'audit_templates',
    'decision_followups',
    'decision_audits'
  ];
  t text;
begin
  foreach t in array audit_tables loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      execute format('alter table public.%I rename to deprecated_%I', t, t);
    end if;
  end loop;
end$$;

-- audit_search_cache held arbitrary cached web responses; safe to drop now
-- since nothing references it any more.
drop table if exists public.deprecated_audit_search_cache cascade;
-- audit_persona_pool was a join table whose definition shifted across
-- iterations; not worth rescuing. CASCADE because deprecated_audit_findings
-- still has a FK constraint pointing at it that's also being dropped.
drop table if exists public.deprecated_audit_persona_pool cascade;

comment on schema public is
  'Audit tables prefixed deprecated_* as of 2026-05-06 reverse pivot. To be dropped after 30-day observation window.';
