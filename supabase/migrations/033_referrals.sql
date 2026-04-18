-- Referral program: each user gets a code, referrals are logged, and a bonus
-- evaluation credit is granted on referee signup. Bonuses are tracked so we can
-- cap them and prevent double-granting.

create table if not exists referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  code text not null references referral_codes(code) on delete cascade,
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referee_id uuid not null references auth.users(id) on delete cascade,
  bonus_granted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (referee_id) -- a referee can only be credited once
);

create index if not exists referrals_referrer_idx on referrals(referrer_id);

alter table referral_codes enable row level security;
alter table referrals enable row level security;

create policy "Users can read own referral code"
  on referral_codes for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own referral code"
  on referral_codes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can read their own referrals"
  on referrals for select
  to authenticated
  using (referrer_id = auth.uid() or referee_id = auth.uid());

-- Service role handles bonus granting (no direct RLS write path for users)
create policy "Service role can manage referrals"
  on referrals for all
  to service_role
  using (true) with check (true);
