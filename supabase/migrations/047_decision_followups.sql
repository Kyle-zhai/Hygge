-- ============================================
-- Decision follow-ups
--
-- After a Decision Audit is signed off, we want to circle back at
-- 7 / 30 / 90 days to ask the decision-maker: "Did you proceed? What
-- changed? Were the surfaced risks accurate?" This closes the learning
-- loop and gives us per-decision outcome data, which feeds both the
-- product (better persona calibration) and the regulator narrative
-- (we measure decision quality, not just decision speed).
--
-- This migration scaffolds the data model and the trigger that enqueues
-- follow-ups automatically. The worker job that sends emails / pings
-- and the user-facing review page are wired separately.
-- ============================================

create table if not exists public.decision_followups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.audit_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  -- 7 / 30 / 90 (days). Kept as int so we can extend without a schema change.
  interval_days int not null check (interval_days > 0),
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'completed', 'skipped')),
  sent_at timestamptz,
  -- Captured when the user fills in the follow-up form on the web app.
  outcome jsonb,
  outcome_recorded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, interval_days)
);

create index if not exists decision_followups_due_idx
  on public.decision_followups (status, due_at)
  where status = 'pending';

create index if not exists decision_followups_user_idx
  on public.decision_followups (user_id, status);

alter table public.decision_followups enable row level security;

drop policy if exists "decision_followups owner read" on public.decision_followups;
create policy "decision_followups owner read"
  on public.decision_followups for select
  using (auth.uid() = user_id);

drop policy if exists "decision_followups owner update" on public.decision_followups;
create policy "decision_followups owner update"
  on public.decision_followups for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================
-- Auto-enqueue 7 / 30 / 90 day follow-ups when an audit reaches
-- signed_off. ON CONFLICT keeps this idempotent across re-signs.
-- ============================================
create or replace function public.enqueue_decision_followups()
returns trigger as $$
begin
  if new.status = 'signed_off' and (old.status is distinct from 'signed_off') then
    insert into public.decision_followups (session_id, user_id, workspace_id, interval_days, due_at)
    values
      (new.id, new.user_id, new.workspace_id, 7,  now() + interval '7 days'),
      (new.id, new.user_id, new.workspace_id, 30, now() + interval '30 days'),
      (new.id, new.user_id, new.workspace_id, 90, now() + interval '90 days')
    on conflict (session_id, interval_days) do nothing;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists audit_sessions_enqueue_followups on public.audit_sessions;
create trigger audit_sessions_enqueue_followups
  after update of status on public.audit_sessions
  for each row execute function public.enqueue_decision_followups();
