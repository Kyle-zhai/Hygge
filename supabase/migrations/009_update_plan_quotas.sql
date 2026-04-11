-- ============================================
-- Update plan quotas — Phase 1 re-tier
-- ============================================
-- Free: 1 → 3 discussions / month
-- Pro:  10 → 15 discussions / month
-- Max:  40 → 60 discussions / month
--
-- Persona-per-discussion limits are enforced in application code
-- (src/lib/stripe/plans.ts), not the DB, so no column changes needed
-- for that dimension.

-- 1. Bump the default for new rows inserted without an explicit limit
alter table public.subscriptions
  alter column evaluations_limit set default 3;

-- 2. Backfill existing subscribers still on the old defaults. We
--    only touch rows where the current limit matches the previous
--    default for that plan — manual overrides are preserved.
update public.subscriptions
  set evaluations_limit = 3
  where plan = 'free' and evaluations_limit = 1;

update public.subscriptions
  set evaluations_limit = 15
  where plan = 'pro' and evaluations_limit = 10;

update public.subscriptions
  set evaluations_limit = 60
  where plan = 'max' and evaluations_limit = 40;

-- 3. Refresh the auto-create trigger so new signups get the new free quota
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.subscriptions (user_id, plan, evaluations_limit)
  values (new.id, 'free', 3);
  return new;
end;
$$ language plpgsql security definer;
