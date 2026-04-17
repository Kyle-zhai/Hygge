-- Track failure reasons + timestamps so we can surface errors and sweep stuck jobs.

alter table public.evaluations
  add column if not exists error_message text,
  add column if not exists failed_at timestamptz;

create index if not exists evaluations_status_created_idx
  on public.evaluations (status, created_at);
