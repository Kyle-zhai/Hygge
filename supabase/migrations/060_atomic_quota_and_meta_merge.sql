-- Atomic quota increment + JSONB merge functions.
--
-- Closes two TOCTOU windows surfaced in the platform-v2 review:
--   1. Quota: route.ts was reading evaluations_used and writing used+1 from
--      app code. Two concurrent POSTs could both read the same value and
--      double-spend a quota slot.
--   2. decision_meta: audit-pipeline persistReport read decision_meta JSONB
--      and wrote a merged copy from app code. Concurrent runs of the same
--      session (BullMQ duplicate or stale-lock retry) could clobber each
--      other's writes silently.
--
-- Both are now done in a single SQL statement, locked at the row level by
-- Postgres MVCC + FOR UPDATE.

-- ============================================
-- increment_evaluations_used(user_id)
-- ============================================
-- Atomic: locks subscription row, checks quota, increments if available.
-- Returns TABLE(success boolean, evaluations_used int, evaluations_limit int).
-- success=false means either no subscription found or quota exhausted —
-- callers must check before proceeding with the gated work.
CREATE OR REPLACE FUNCTION public.increment_evaluations_used(p_user_id UUID)
RETURNS TABLE(success BOOLEAN, evaluations_used INT, evaluations_limit INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_used INT;
  v_limit INT;
BEGIN
  SELECT s.evaluations_used, s.evaluations_limit
  INTO v_used, v_limit
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    success := FALSE;
    evaluations_used := 0;
    evaluations_limit := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_used >= v_limit THEN
    success := FALSE;
    evaluations_used := v_used;
    evaluations_limit := v_limit;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.subscriptions
  SET evaluations_used = v_used + 1
  WHERE user_id = p_user_id;

  success := TRUE;
  evaluations_used := v_used + 1;
  evaluations_limit := v_limit;
  RETURN NEXT;
END;
$$;

-- ============================================
-- decrement_evaluations_used(user_id)
-- ============================================
-- Atomic refund — used after a successful increment when the gated work
-- subsequently failed (e.g., audit_trail write failed, BullMQ enqueue
-- failed). Floors at 0 to prevent negative usage on a duplicate decrement.
CREATE OR REPLACE FUNCTION public.decrement_evaluations_used(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.subscriptions
  SET evaluations_used = GREATEST(evaluations_used - 1, 0)
  WHERE user_id = p_user_id;
END;
$$;

-- ============================================
-- audit_session_merge_decision_meta(session_id, merge)
-- ============================================
-- Single-statement JSONB shallow merge. Replaces the read-modify-write
-- pattern in audit-pipeline.ts persistReport. Postgres `||` does a
-- shallow merge: top-level keys in p_merge override existing keys, all
-- other top-level keys are preserved.
--
-- Raises if the session row doesn't exist so callers don't silently
-- proceed against a missing session (which would have been a no-op
-- update under the previous read-modify-write code).
CREATE OR REPLACE FUNCTION public.audit_session_merge_decision_meta(
  p_session_id UUID,
  p_merge JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.audit_sessions
  SET decision_meta = COALESCE(decision_meta, '{}'::jsonb) || p_merge
  WHERE id = p_session_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'audit_session % not found', p_session_id;
  END IF;
END;
$$;

-- ============================================
-- Permissions
-- ============================================
-- Quota functions: callable by the authenticated user (acts on their own
-- row only because p_user_id must match auth.uid() — enforced at the route
-- layer; SECURITY DEFINER means the function bypasses RLS so we don't have
-- to weaken the subscriptions RLS policy).
REVOKE ALL ON FUNCTION public.increment_evaluations_used(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_evaluations_used(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.decrement_evaluations_used(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_evaluations_used(UUID) TO authenticated, service_role;

-- decision_meta merge: only the worker should call this. Service role only.
REVOKE ALL ON FUNCTION public.audit_session_merge_decision_meta(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_session_merge_decision_meta(UUID, JSONB) TO service_role;
