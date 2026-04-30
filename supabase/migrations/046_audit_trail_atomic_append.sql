-- pgcrypto is enabled by default on Supabase but be explicit; we need digest().
create extension if not exists pgcrypto;

-- ============================================
-- Atomic audit_trail append.
--
-- The previous worker code had a TOCTOU race: it read the highest seq with
-- one query, then inserted with seq=N+1 in a second query. Two concurrent
-- worker jobs (or a retried job) could read the same seq and fight over the
-- (session_id, seq) unique key, OR worse, both compute the same prev_hash
-- and produce a forking chain that breaks downstream verification.
--
-- This function wraps the read + insert + head-hash update in one
-- transaction with a row-level lock on the session row. SECURITY DEFINER
-- so the worker (anon/service role) can call it without write access to
-- audit_trail directly. The immutability triggers from migration 044 still
-- prevent UPDATE/DELETE on audit_trail rows themselves.
-- ============================================

create or replace function public.audit_trail_append(
  p_session_id uuid,
  p_action text,
  p_actor_id uuid,
  p_payload jsonb,
  p_payload_sha256 text,
  p_ts timestamptz
)
returns table (seq int, this_hash text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_hash text;
  v_next_seq int;
  v_this_hash text;
begin
  -- Lock the session row so concurrent appenders serialize on it. This is
  -- cheap because we only ever take this lock inside this function and
  -- release it at commit.
  select audit_trail_head_hash
    into v_prev_hash
    from public.audit_sessions
   where id = p_session_id
   for update;

  if not found then
    raise exception 'audit_trail_append: session % not found', p_session_id;
  end if;

  select coalesce(max(seq), -1) + 1
    into v_next_seq
    from public.audit_trail
   where session_id = p_session_id;

  v_this_hash := encode(
    digest(
      coalesce(v_prev_hash, '') || '|' || p_payload_sha256 || '|' || to_char(p_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'sha256'
    ),
    'hex'
  );

  insert into public.audit_trail (
    session_id, seq, action, actor_id, payload,
    payload_sha256, prev_hash, this_hash, ts
  ) values (
    p_session_id, v_next_seq, p_action, p_actor_id, p_payload,
    p_payload_sha256, nullif(v_prev_hash, ''), v_this_hash, p_ts
  );

  update public.audit_sessions
     set audit_trail_head_hash = v_this_hash
   where id = p_session_id;

  return query select v_next_seq, v_this_hash;
end;
$$;

grant execute on function public.audit_trail_append(uuid, text, uuid, jsonb, text, timestamptz) to service_role;
