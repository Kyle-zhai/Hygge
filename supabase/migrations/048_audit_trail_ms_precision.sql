-- ============================================
-- Lock audit_trail.ts to millisecond precision.
--
-- The canonical hash form (`to_char(... 'MS')`) is 3-digit-millisecond. The
-- stored `ts` column is timestamptz(6) and the JS callers send 3-digit-ms via
-- `Date.toISOString()`, so today there is no divergence. But if any future
-- backfill script or SQL test inserts a row with sub-millisecond precision,
-- `to_char` would emit the truncated ms in the hash while `ts` retains the
-- microseconds — leaving a foot-gun.
--
-- Defensive fix: explicitly truncate `p_ts` to ms before insert AND before
-- hashing. The RPC is the only sanctioned write path (audit_trail rows are
-- otherwise insert-only at the trigger level), so this enforces ms-precision
-- end-to-end.
-- ============================================

create or replace function public.audit_trail_append(
  p_session_id uuid,
  p_action text,
  p_actor_id uuid,
  p_payload jsonb,
  p_payload_sha256 text,
  p_ts timestamptz
) returns table (seq int, this_hash text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_hash text;
  v_next_seq int;
  v_this_hash text;
  v_ts_ms timestamptz;
begin
  v_ts_ms := date_trunc('milliseconds', p_ts);

  select audit_trail_head_hash into v_prev_hash
    from public.audit_sessions
    where id = p_session_id
    for update;
  if not found then
    raise exception 'audit_trail_append: session % not found', p_session_id;
  end if;

  select coalesce(max(seq), -1) + 1 into v_next_seq
    from public.audit_trail
    where session_id = p_session_id;

  v_this_hash := encode(
    digest(
      coalesce(v_prev_hash, '') || '|' || p_payload_sha256 || '|' ||
        to_char(v_ts_ms at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'sha256'
    ),
    'hex'
  );

  insert into public.audit_trail (
    session_id, seq, action, actor_id, payload,
    payload_sha256, prev_hash, this_hash, ts
  ) values (
    p_session_id, v_next_seq, p_action, p_actor_id, p_payload,
    p_payload_sha256, nullif(v_prev_hash, ''), v_this_hash, v_ts_ms
  );

  update public.audit_sessions
    set audit_trail_head_hash = v_this_hash
    where id = p_session_id;

  return query select v_next_seq, v_this_hash;
end;
$$;

grant execute on function public.audit_trail_append(uuid, text, uuid, jsonb, text, timestamptz)
  to service_role;
