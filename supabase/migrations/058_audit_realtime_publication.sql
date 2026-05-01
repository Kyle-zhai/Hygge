-- 058_audit_realtime_publication.sql
--
-- Enable Supabase realtime push for the audit feature.
--
-- Symptom this fixes: the audit detail page (`/audit/[id]`) sets up a
-- supabase-js channel subscribed to `audit_sessions` / `audit_findings` /
-- `audit_signoffs` updates. The subscription succeeds, but no events ever
-- arrive — the UI stays on the initial server-rendered snapshot, so a
-- completed audit still shows "running" until the user hard-refreshes.
--
-- Cause: Supabase's realtime layer only emits change events for tables
-- that are members of the `supabase_realtime` publication. Migration 001
-- added evaluations + persona_reviews; migration 016 added debate_messages.
-- The audit tables (created in 044) were never added.
--
-- Adding them here. RLS still applies to realtime broadcasts (Supabase
-- routes events through RLS using the subscriber's JWT), so this does
-- not leak rows across users.

set client_min_messages to warning;

alter publication supabase_realtime add table public.audit_sessions;
alter publication supabase_realtime add table public.audit_findings;
alter publication supabase_realtime add table public.audit_signoffs;
