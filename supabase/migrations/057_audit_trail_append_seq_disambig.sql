-- 057_audit_trail_append_seq_disambig.sql
--
-- Fix `column reference "seq" is ambiguous` AND `function digest(text,
-- unknown) does not exist` in audit_trail_append.
--
-- Two pre-existing bugs in migration 046, neither of which surfaced
-- before because nobody had successfully completed an audit session
-- start in production yet:
--
-- 1. `RETURNS TABLE (seq int, ...)` injects `seq` as a variable in
--    the function body. Inside `audit_trail_append`, the bare name
--    `seq` matched BOTH the OUT column AND `public.audit_trail.seq`,
--    so Postgres aborted with:
--      column reference "seq" is ambiguous
--
-- 2. `set search_path = public` excludes the `extensions` schema
--    where Supabase installs pgcrypto. So `digest(...)` couldn't
--    resolve at runtime, failing with:
--      function digest(text, unknown) does not exist
--
-- Fixes:
--   - Qualify the SELECT with `audit_trail.seq` to disambiguate.
--     Keeping the original RETURNS TABLE column names means
--     CREATE OR REPLACE is allowed (changing the return type would
--     force DROP+CREATE).
--   - Set search_path = public, extensions so pgcrypto's digest()
--     resolves. This matches Supabase's standard pgcrypto location.

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
set search_path = public, extensions
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
