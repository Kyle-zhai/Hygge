-- 053_audit_findings_multi_agent.sql
--
-- Multi-agent audit kernel: extends audit_findings with the fields the new
-- kernel emits (confidence, basis, citations, law_id, task_id, dissent,
-- search_cache_ids). Adds a separate pool_persona_id ref so we can store
-- findings produced by audit_persona_pool personas (without requiring them
-- to also exist in the public.personas table).
--
-- Spec: docs/superpowers/specs/2026-04-30-multi-agent-audit-architecture.md §6
--
-- Backward compat: old findings written by audit-council.ts (migration 044/045
-- kernel) keep using persona_id → public.personas. New findings written by the
-- multi-agent kernel use pool_persona_id → public.audit_persona_pool.
-- A CHECK constraint requires at least one of the two persona references.

set client_min_messages to warning;

-- ============================================
-- Relax persona_id so the new kernel can write findings without a
-- corresponding personas row.
-- ============================================
alter table public.audit_findings
  drop constraint if exists audit_findings_persona_id_fkey;

alter table public.audit_findings
  alter column persona_id drop not null;

-- ============================================
-- New columns for the multi-agent kernel
-- ============================================
alter table public.audit_findings
  add column if not exists pool_persona_id text
    references public.audit_persona_pool(id) on delete set null;

alter table public.audit_findings
  add column if not exists confidence text
    check (confidence is null or confidence in ('settled','unsettled','speculative'));

alter table public.audit_findings
  add column if not exists basis text
    check (basis is null or basis in (
      'statute','regulation','agency_guidance','case_law','secondary_source'
    ));

alter table public.audit_findings
  add column if not exists citations jsonb not null default '[]'::jsonb;

alter table public.audit_findings
  add column if not exists law_id text
    references public.audit_law_catalog(id) on delete set null;

alter table public.audit_findings
  add column if not exists law_section text;

alter table public.audit_findings
  add column if not exists task_id text;

alter table public.audit_findings
  add column if not exists dissent jsonb;

alter table public.audit_findings
  add column if not exists search_cache_ids uuid[] not null default '{}'::uuid[];

-- ============================================
-- At least one persona reference must be set
-- ============================================
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'audit_findings_persona_or_pool_check'
      and conrelid = 'public.audit_findings'::regclass
  ) then
    alter table public.audit_findings
      add constraint audit_findings_persona_or_pool_check
      check (persona_id is not null or pool_persona_id is not null);
  end if;
end $$;

-- ============================================
-- Indexes
-- ============================================
create index if not exists audit_findings_law_idx
  on public.audit_findings (law_id);

create index if not exists audit_findings_pool_persona_idx
  on public.audit_findings (pool_persona_id);

create index if not exists audit_findings_task_idx
  on public.audit_findings (session_id, task_id);

create index if not exists audit_findings_confidence_idx
  on public.audit_findings (session_id, confidence);
