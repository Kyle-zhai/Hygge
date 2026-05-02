-- 059_audit_security_hardening.sql
--
-- Two security/correctness fixes flagged by /review on the audit feature:
--
-- 1. audit_session_files RLS insert/update only checked auth.uid() = user_id.
--    The session_id column was accepted unchecked, so any authenticated user
--    could write a row with their own user_id but a victim's session_id.
--    On the victim's next pipeline run, loadSessionFiles(sessionId) would
--    pull that attacker-controlled row, decode it, and feed it into the
--    decisionText that reaches every audit agent (planner, analyst,
--    synthesizer) and the persisted synthesized_report. That's a direct
--    cross-tenant prompt-injection / content-injection vector.
--
--    Fix: tighten the with-check to also require that any non-null
--    session_id belongs to a session owned by the same user. Also pin
--    user_id to auth.uid() on update so the row can't be re-homed.
--
-- 2. audit_sessions / audit_findings / audit_signoffs were added to the
--    supabase_realtime publication in migration 058, but their REPLICA
--    IDENTITY was still the default (primary key only). Postgres logical
--    replication then emits UPDATE payloads carrying only the primary key
--    + changed columns. The audit detail page does
--      setSession(payload.new as AuditSession)
--    which expects a full row; with a partial payload, every other field
--    in client state silently goes to undefined / blank.
--
--    Fix: set REPLICA IDENTITY FULL so realtime UPDATE events include the
--    entire row. Storage cost is negligible at our row volumes.

set client_min_messages to warning;

-- ============================================
-- audit_session_files: tighten cross-session insert/update
-- ============================================
drop policy if exists "audit_session_files owner insert" on public.audit_session_files;
create policy "audit_session_files owner insert"
  on public.audit_session_files for insert
  with check (
    auth.uid() = user_id
    and (
      session_id is null
      or exists (
        select 1
          from public.audit_sessions s
         where s.id = session_id
           and s.user_id = auth.uid()
      )
    )
  );

drop policy if exists "audit_session_files owner update" on public.audit_session_files;
create policy "audit_session_files owner update"
  on public.audit_session_files for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      session_id is null
      or exists (
        select 1
          from public.audit_sessions s
         where s.id = session_id
           and s.user_id = auth.uid()
      )
    )
  );

-- ============================================
-- Realtime UPDATE payloads must carry the full row
-- ============================================
alter table public.audit_sessions replica identity full;
alter table public.audit_findings replica identity full;
alter table public.audit_signoffs replica identity full;
