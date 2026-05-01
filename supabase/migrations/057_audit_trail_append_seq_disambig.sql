-- 057_audit_trail_append_seq_disambig.sql
--
-- Fix `column reference "seq" is ambiguous` in audit_trail_append.
--
-- Postgres treats the names declared in `RETURNS TABLE (seq int, ...)`
-- as variables inside the function body. Inside audit_trail_append the
-- bare name `seq` matched BOTH the OUT column from RETURNS TABLE and
-- `public.audit_trail.seq` — Postgres rejected the SELECT with
-- `column reference "seq" is ambiguous` and every audit session
-- creation failed with:
--
--   Failed to write opening audit_trail row, rolling back session:
--   audit_trail.append: rpc failed (column reference "seq" is ambiguous)
--
-- Fix: keep the function signature unchanged (so CREATE OR REPLACE is
-- allowed; renaming OUT columns would change the return type and
-- require DROP+CREATE), and instead qualify the column reference as
-- `audit_trail.seq`. That removes the ambiguity unambiguously.

set client_min_messages to warning;

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
  select audit_trail_head_hash
    into v_prev_hash
    from public.audit_sessions
   where id = p_session_id
   for update;

  if not found then
    raise exception 'audit_trail_append: session % not found', p_session_id;
  end if;

  -- Qualify the column to disambiguate from the OUT column of the same
  -- name declared in RETURNS TABLE.
  select coalesce(max(audit_trail.seq), -1) + 1
    into v_next_seq
    from public.audit_trail
   where audit_trail.session_id = p_session_id;

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
