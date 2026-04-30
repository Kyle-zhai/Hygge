-- 044_decision_audits.sql
--
-- Decision Audit / Pre-Mortem Council pivot (Lane C).
-- Spec: docs/superpowers/specs/2026-04-30-decision-audit-pivot.md
--
-- Reuses the existing Persona + Council engine but stores results in a
-- regulated-decision shape: Risk Register + immutable hash-chained audit trail
-- + signed signoffs. Tables here are additive — /evaluate and /debates remain
-- untouched.

-- ============================================
-- audit_templates
-- (seeded in 045_seed_audit_templates.sql)
-- ============================================
create table if not exists public.audit_templates (
  slug text primary key,
  name_en text not null,
  name_zh text not null,
  description_en text not null,
  description_zh text not null,
  regulation_refs text[] not null default '{}',
  -- personas.id is TEXT in production
  default_persona_ids text[] not null,
  system_prompt_overlay text not null,
  output_schema jsonb not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists audit_templates_active_idx
  on public.audit_templates (is_active, display_order);

-- ============================================
-- audit_sessions
-- One row per audit run. `evaluation_id` links to the underlying council run
-- so we reuse all existing belief-state / argument-graph / feedback machinery.
-- ============================================
create table if not exists public.audit_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  template_slug text not null references public.audit_templates(slug),

  decision_text text not null,
  decision_text_sha256 text not null,
  decision_meta jsonb not null default '{}',

  status text not null default 'pending'
    check (status in ('pending','running','findings_ready','signed_off','archived','failed')),

  evaluation_id uuid references public.evaluations(id) on delete set null,

  signed_off_by uuid references auth.users(id),
  signed_off_at timestamptz,
  signed_off_signature text,

  audit_trail_head_hash text,

  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists audit_sessions_user_idx on public.audit_sessions (user_id, created_at desc);
create index if not exists audit_sessions_workspace_idx on public.audit_sessions (workspace_id, created_at desc);
create index if not exists audit_sessions_status_idx on public.audit_sessions (status);
create index if not exists audit_sessions_template_idx on public.audit_sessions (template_slug);

-- ============================================
-- audit_findings
-- One row per persona-emitted risk / blind-spot / dissent / mitigation /
-- explicit no_risk. User dispositions live on the same row.
-- ============================================
create table if not exists public.audit_findings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.audit_sessions(id) on delete cascade,
  persona_id text not null references public.personas(id) on delete cascade,

  finding_kind text not null
    check (finding_kind in ('risk','blind_spot','dissent','mitigation','no_risk')),

  severity smallint check (severity is null or severity between 1 and 5),
  probability smallint check (probability is null or probability between 1 and 5),

  claim text not null,
  evidence_refs jsonb not null default '[]',
  suggested_mitigation text,

  user_disposition text
    check (user_disposition is null or user_disposition in
      ('accept_mitigation','accept_residual','reject','defer')),
  user_disposition_note text,
  user_disposition_at timestamptz,

  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists audit_findings_session_idx
  on public.audit_findings (session_id, display_order);
create index if not exists audit_findings_persona_idx
  on public.audit_findings (persona_id, finding_kind);
create index if not exists audit_findings_severity_idx
  on public.audit_findings (session_id, severity desc, probability desc);

-- ============================================
-- audit_trail
-- Immutable append-only log with SHA-256 hash chain. Every state mutation
-- writes a row. The chain is verifiable offline from the exported PDF.
--   prev_hash  = audit_trail_head_hash on the session before this row
--   this_hash  = sha256(prev_hash || payload_sha256 || ts_iso8601)
-- ============================================
create table if not exists public.audit_trail (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.audit_sessions(id) on delete cascade,
  seq int not null,
  action text not null,
  actor_id uuid references auth.users(id),
  payload jsonb not null,
  payload_sha256 text not null,
  prev_hash text,
  this_hash text not null,
  ts timestamptz not null default now(),
  unique (session_id, seq)
);

create index if not exists audit_trail_session_idx
  on public.audit_trail (session_id, seq);

-- audit_trail rows are write-once. A trigger blocks UPDATE / DELETE so the
-- hash chain cannot be forged after the fact. Service-role inserts only.
create or replace function public.audit_trail_block_mutations()
returns trigger as $$
begin
  raise exception 'audit_trail rows are immutable';
end;
$$ language plpgsql;

drop trigger if exists audit_trail_no_update on public.audit_trail;
create trigger audit_trail_no_update
  before update on public.audit_trail
  for each row execute function public.audit_trail_block_mutations();

drop trigger if exists audit_trail_no_delete on public.audit_trail;
create trigger audit_trail_no_delete
  before delete on public.audit_trail
  for each row execute function public.audit_trail_block_mutations();

-- ============================================
-- audit_signoffs
-- Multi-signoff support — e.g. PM signs as decision-owner, compliance officer
-- signs as oversight. PDF includes all rows.
-- ============================================
create table if not exists public.audit_signoffs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.audit_sessions(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  role text not null,
  signature text not null,
  email_confirmed_at timestamptz,
  ip_hash text,
  created_at timestamptz not null default now(),
  unique (session_id, actor_id, role)
);

create index if not exists audit_signoffs_session_idx
  on public.audit_signoffs (session_id);

-- ============================================
-- RLS
-- Mirrors the workspace-aware ownership chain from projects/evaluations:
-- a session is visible to (a) its owner, (b) any member of its workspace.
-- ============================================
alter table public.audit_templates enable row level security;
alter table public.audit_sessions enable row level security;
alter table public.audit_findings enable row level security;
alter table public.audit_trail enable row level security;
alter table public.audit_signoffs enable row level security;

-- audit_templates: world-readable for active templates
drop policy if exists "audit_templates public read" on public.audit_templates;
create policy "audit_templates public read"
  on public.audit_templates for select
  using (is_active = true);

-- audit_sessions
drop policy if exists "audit_sessions owner read" on public.audit_sessions;
create policy "audit_sessions owner read"
  on public.audit_sessions for select
  using (
    auth.uid() = user_id
    or (
      workspace_id is not null
      and exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = audit_sessions.workspace_id
          and wm.user_id = auth.uid()
      )
    )
  );

drop policy if exists "audit_sessions owner write" on public.audit_sessions;
create policy "audit_sessions owner write"
  on public.audit_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "audit_sessions owner update" on public.audit_sessions;
create policy "audit_sessions owner update"
  on public.audit_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- audit_findings: visible if parent session is visible; user can only
-- update disposition fields on their own session.
drop policy if exists "audit_findings read via session" on public.audit_findings;
create policy "audit_findings read via session"
  on public.audit_findings for select
  using (
    exists (
      select 1 from public.audit_sessions s
      where s.id = audit_findings.session_id
        and (
          s.user_id = auth.uid()
          or (
            s.workspace_id is not null
            and exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = s.workspace_id
                and wm.user_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists "audit_findings update disposition" on public.audit_findings;
create policy "audit_findings update disposition"
  on public.audit_findings for update
  using (
    exists (
      select 1 from public.audit_sessions s
      where s.id = audit_findings.session_id
        and s.user_id = auth.uid()
    )
  );

-- audit_trail: read-only for session owners + workspace members.
-- Inserts come from the service role only (worker / API server-side).
drop policy if exists "audit_trail read via session" on public.audit_trail;
create policy "audit_trail read via session"
  on public.audit_trail for select
  using (
    exists (
      select 1 from public.audit_sessions s
      where s.id = audit_trail.session_id
        and (
          s.user_id = auth.uid()
          or (
            s.workspace_id is not null
            and exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = s.workspace_id
                and wm.user_id = auth.uid()
            )
          )
        )
    )
  );

-- audit_signoffs: visible to session owners + workspace members.
-- Insert is gated to the actor.
drop policy if exists "audit_signoffs read via session" on public.audit_signoffs;
create policy "audit_signoffs read via session"
  on public.audit_signoffs for select
  using (
    exists (
      select 1 from public.audit_sessions s
      where s.id = audit_signoffs.session_id
        and (
          s.user_id = auth.uid()
          or (
            s.workspace_id is not null
            and exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = s.workspace_id
                and wm.user_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists "audit_signoffs actor insert" on public.audit_signoffs;
create policy "audit_signoffs actor insert"
  on public.audit_signoffs for insert
  with check (auth.uid() = actor_id);
