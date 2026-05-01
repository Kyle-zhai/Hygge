-- 056_audit_session_files.sql
--
-- Decision-document persistence for the audit feature.
--
-- Why: prior to this migration, files uploaded via /api/audit/parse-file were
-- read once, the extracted text was inlined into audit_sessions.decision_text,
-- and the original file was discarded. That meant:
--   1. We can never re-parse the source with a better extractor.
--   2. The audit pipeline (worker) can't access embedded images for vision
--      analysis (Gap 6 in the persistence plan).
--   3. Multi-file uploads (memo + slides + spreadsheet) had no schema home.
--
-- This migration introduces:
--   - public.audit_session_files: one row per uploaded file. Linked to the
--     audit session that owns it. Stores parser metadata + a reference to the
--     binary in Supabase Storage.
--   - storage bucket "audit-uploads" (private). Files live at
--     {user_id}/{session_id}/{file_id}.{ext}. The {user_id} prefix is what
--     enforces RLS at the storage layer.
--   - RLS on storage.objects so users can only read/write their own files.

set client_min_messages to warning;

-- ============================================
-- audit_session_files table
-- ============================================
-- session_id is nullable so files can be uploaded BEFORE the session row
-- exists (the intake flow uploads in parallel with the user filling the form).
-- A nightly job can sweep orphans (session_id IS NULL AND created_at < now() - 24h).
create table if not exists public.audit_session_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.audit_sessions(id) on delete cascade,

  filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  -- Path inside the audit-uploads bucket. e.g. "{user_id}/{session_id}/{id}.pdf"
  -- Kept text rather than parsed because Supabase Storage doesn't expose
  -- a stable opaque ID and we want a single source of truth.
  storage_path text not null,

  -- Cached parser output so the worker doesn't re-run officeparser on every
  -- pipeline retry. Refreshed only when the file changes (it doesn't — files
  -- are immutable once uploaded).
  extracted_text text,
  extracted_text_truncated boolean not null default false,
  extracted_bytes integer,
  ocr_applied boolean not null default false,
  -- Per-attachment metadata (name, mime, alt, ocr_text, has_data). Image
  -- bytes themselves stay in Storage; this is just the index.
  attachments_meta jsonb not null default '[]',
  parser_error text,

  created_at timestamptz not null default now(),
  attached_at timestamptz
);

create index if not exists audit_session_files_session_idx
  on public.audit_session_files (session_id, created_at);

create index if not exists audit_session_files_user_idx
  on public.audit_session_files (user_id, created_at desc);

-- Orphan sweep helper: pending uploads with no session.
create index if not exists audit_session_files_orphan_idx
  on public.audit_session_files (created_at)
  where session_id is null;

alter table public.audit_session_files enable row level security;

-- Owner can do everything via RLS. Worker uses service_role which bypasses RLS.
drop policy if exists "audit_session_files owner select" on public.audit_session_files;
create policy "audit_session_files owner select"
  on public.audit_session_files for select
  using (auth.uid() = user_id);

drop policy if exists "audit_session_files owner insert" on public.audit_session_files;
create policy "audit_session_files owner insert"
  on public.audit_session_files for insert
  with check (auth.uid() = user_id);

drop policy if exists "audit_session_files owner update" on public.audit_session_files;
create policy "audit_session_files owner update"
  on public.audit_session_files for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "audit_session_files owner delete" on public.audit_session_files;
create policy "audit_session_files owner delete"
  on public.audit_session_files for delete
  using (auth.uid() = user_id);

-- ============================================
-- Storage bucket
-- ============================================
-- Private bucket (public = false). Reads/writes go through signed URLs or
-- the service role from the worker.
insert into storage.buckets (id, name, public, file_size_limit)
  values ('audit-uploads', 'audit-uploads', false, 10 * 1024 * 1024)
  on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- Storage RLS: a user can only see/upload to objects under their own
-- {user_id}/ prefix. (split_part picks the first path segment.)
drop policy if exists "audit-uploads owner read" on storage.objects;
create policy "audit-uploads owner read"
  on storage.objects for select
  using (
    bucket_id = 'audit-uploads'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "audit-uploads owner insert" on storage.objects;
create policy "audit-uploads owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'audit-uploads'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "audit-uploads owner delete" on storage.objects;
create policy "audit-uploads owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'audit-uploads'
    and split_part(name, '/', 1) = auth.uid()::text
  );
