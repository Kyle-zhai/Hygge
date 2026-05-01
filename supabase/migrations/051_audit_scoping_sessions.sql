-- 051_audit_scoping_sessions.sql
--
-- Multi-agent audit kernel: Layer 1b conversational scoping state machine.
-- Spec: docs/superpowers/specs/2026-04-30-multi-agent-audit-architecture.md §3, §6
--
-- One row per audit session that's in scoping. Status transitions:
--   created → annotating → scoping → (awaiting_user ⇄ scoping)* → scope_locked
--                      └→ failed (on error, manually unstickable)
--
-- The processor (worker/src/processors/audit-scoping.ts) loads a row, advances
-- the cursor through annotated passages, and either updates scope or pauses
-- with a pending_question. User responds via API; processor resumes.

set client_min_messages to warning;

-- ============================================
-- audit_scoping_sessions
-- ============================================
create table if not exists public.audit_scoping_sessions (
  id uuid primary key default gen_random_uuid(),
  audit_session_id uuid not null references public.audit_sessions(id) on delete cascade,

  status text not null default 'created'
    check (status in ('created','annotating','scoping','awaiting_user','scope_locked','failed')),

  -- Layer 1a output: passages with annotation tags
  -- Shape: [{ idx, text, annotations: ['biometric','minors',...] }]
  passages jsonb not null default '[]'::jsonb,

  -- next passage index to process (advances as Layer 1b emits updates)
  cursor int not null default 0,

  -- Conversation log: chronological array of turns.
  -- Shape: [{ role: 'system'|'user', kind: 'question'|'answer'|'scope_update'|'note',
  --           text, ts, refs: { passage_idx?, law_id? } }]
  conversation jsonb not null default '[]'::jsonb,

  -- Single open question (null when none). When non-null, status='awaiting_user'.
  -- Shape: { id, text, context, answer_format: 'yes_no'|'single_select'|'free_text',
  --          options: [...] | null, asked_at_passage_idx }
  pending_question jsonb,

  -- Locked scope outputs (built up during scoping, finalized at scope_locked)
  -- Shape: [{ law_id, status, reason, passage_refs: [...] }]
  scope_in jsonb not null default '[]'::jsonb,
  scope_out jsonb not null default '[]'::jsonb,

  -- Hard cap to prevent runaway question loops
  question_count int not null default 0,
  max_questions int not null default 8,

  -- Failure surface
  error_message text,
  error_count int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scope_locked_at timestamptz
);

-- One scoping session per audit session (enforce 1:1)
create unique index if not exists audit_scoping_sessions_audit_unique
  on public.audit_scoping_sessions (audit_session_id);

create index if not exists audit_scoping_sessions_status_idx
  on public.audit_scoping_sessions (status);

create index if not exists audit_scoping_sessions_awaiting_idx
  on public.audit_scoping_sessions (status)
  where status = 'awaiting_user';

-- ============================================
-- updated_at trigger
-- ============================================
create or replace function public.audit_scoping_sessions_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists audit_scoping_sessions_updated_at on public.audit_scoping_sessions;
create trigger audit_scoping_sessions_updated_at
  before update on public.audit_scoping_sessions
  for each row execute function public.audit_scoping_sessions_touch_updated_at();

-- ============================================
-- RLS — visible to audit_session owner + workspace members
-- ============================================
alter table public.audit_scoping_sessions enable row level security;

drop policy if exists "scoping read via audit session" on public.audit_scoping_sessions;
create policy "scoping read via audit session"
  on public.audit_scoping_sessions for select
  using (
    exists (
      select 1 from public.audit_sessions a
      where a.id = audit_scoping_sessions.audit_session_id
        and (
          a.user_id = auth.uid()
          or (
            a.workspace_id is not null
            and exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = a.workspace_id
                and wm.user_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists "scoping write via audit session owner" on public.audit_scoping_sessions;
create policy "scoping write via audit session owner"
  on public.audit_scoping_sessions for insert
  with check (
    exists (
      select 1 from public.audit_sessions a
      where a.id = audit_scoping_sessions.audit_session_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists "scoping update via audit session owner" on public.audit_scoping_sessions;
create policy "scoping update via audit session owner"
  on public.audit_scoping_sessions for update
  using (
    exists (
      select 1 from public.audit_sessions a
      where a.id = audit_scoping_sessions.audit_session_id
        and a.user_id = auth.uid()
    )
  );

-- ============================================
-- Helper RPCs (called by API + worker, not by clients directly)
-- ============================================

-- record_scoping_answer: append user answer + clear pending_question + flip status
create or replace function public.record_scoping_answer(
  p_scoping_id uuid,
  p_answer text
) returns public.audit_scoping_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.audit_scoping_sessions;
  v_question jsonb;
begin
  select * into v_row
  from public.audit_scoping_sessions
  where id = p_scoping_id
  for update;

  if not found then
    raise exception 'scoping session not found';
  end if;

  if v_row.status <> 'awaiting_user' or v_row.pending_question is null then
    raise exception 'no pending question to answer (status=%)', v_row.status;
  end if;

  v_question := v_row.pending_question;

  update public.audit_scoping_sessions s
  set
    conversation = s.conversation || jsonb_build_array(jsonb_build_object(
      'role', 'user',
      'kind', 'answer',
      'text', p_answer,
      'ts', to_jsonb(now()),
      'refs', jsonb_build_object('question_id', v_question->>'id')
    )),
    pending_question = null,
    status = 'scoping',
    question_count = s.question_count + 1
  where s.id = p_scoping_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_scoping_answer(uuid, text) from public;
grant execute on function public.record_scoping_answer(uuid, text) to authenticated;

-- finalize_scope: lock scope_in/scope_out and flip to scope_locked
create or replace function public.finalize_scoping_session(
  p_scoping_id uuid,
  p_force boolean default false
) returns public.audit_scoping_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.audit_scoping_sessions;
begin
  select * into v_row
  from public.audit_scoping_sessions
  where id = p_scoping_id
  for update;

  if not found then
    raise exception 'scoping session not found';
  end if;

  if v_row.status = 'scope_locked' then
    return v_row; -- idempotent
  end if;

  if not p_force and v_row.pending_question is not null then
    raise exception 'cannot finalize with pending question; pass p_force=true to override';
  end if;

  update public.audit_scoping_sessions s
  set
    status = 'scope_locked',
    pending_question = null,
    scope_locked_at = now()
  where s.id = p_scoping_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.finalize_scoping_session(uuid, boolean) from public;
grant execute on function public.finalize_scoping_session(uuid, boolean) to authenticated;
