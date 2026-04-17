-- First-time user onboarding flag — stored on `subscriptions` since that is
-- the existing per-user table. Null means the user has not yet completed
-- (or dismissed) the onboarding flow.
alter table subscriptions
  add column if not exists onboarding_completed_at timestamptz;
