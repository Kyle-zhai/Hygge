-- 054_audit_scoping_rpc_auth.sql
--
-- Tighten SECURITY DEFINER RPCs in 051: add explicit auth.uid() ownership
-- checks. Without these, any authenticated user can call the RPC with any
-- scoping_id and answer/finalize someone else's session — RLS doesn't apply
-- to SECURITY DEFINER bodies.
--
-- Workspace members can read/answer just like the SELECT/UPDATE policies
-- already permit on the table (see 051's RLS).

set client_min_messages to warning;

-- ============================================
-- record_scoping_answer: gate on owner + workspace member
-- ============================================
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
  v_session public.audit_sessions;
  v_question jsonb;
begin
  select * into v_row
  from public.audit_scoping_sessions
  where id = p_scoping_id
  for update;

  if not found then
    raise exception 'scoping session not found';
  end if;

  -- Ownership gate (auth.uid() works inside SECURITY DEFINER; only RLS is bypassed).
  select * into v_session
  from public.audit_sessions
  where id = v_row.audit_session_id;

  if not found then
    raise exception 'parent audit session not found';
  end if;

  if v_session.user_id <> auth.uid()
     and not (
       v_session.workspace_id is not null
       and exists (
         select 1 from public.workspace_members wm
         where wm.workspace_id = v_session.workspace_id
           and wm.user_id = auth.uid()
       )
     ) then
    raise exception 'forbidden';
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

-- ============================================
-- finalize_scoping_session: gate on owner + workspace member
-- ============================================
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
  v_session public.audit_sessions;
begin
  select * into v_row
  from public.audit_scoping_sessions
  where id = p_scoping_id
  for update;

  if not found then
    raise exception 'scoping session not found';
  end if;

  select * into v_session
  from public.audit_sessions
  where id = v_row.audit_session_id;

  if not found then
    raise exception 'parent audit session not found';
  end if;

  if v_session.user_id <> auth.uid()
     and not (
       v_session.workspace_id is not null
       and exists (
         select 1 from public.workspace_members wm
         where wm.workspace_id = v_session.workspace_id
           and wm.user_id = auth.uid()
       )
     ) then
    raise exception 'forbidden';
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
