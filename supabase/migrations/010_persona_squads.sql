-- ============================================
-- Persona Squads — saved lineups for reuse
-- ============================================
-- A "squad" is a named selection of persona IDs a user wants to
-- reuse across discussions (e.g. "Product launch panel"). This is
-- a thin table — validation of persona_ids membership is left to
-- the app layer since personas are platform-maintained.

create table public.persona_squads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  persona_ids uuid[] not null check (array_length(persona_ids, 1) between 1 and 30),
  created_at timestamptz not null default now()
);

create index idx_persona_squads_user_id on public.persona_squads(user_id, created_at desc);

alter table public.persona_squads enable row level security;

create policy "Users can view own squads"
  on public.persona_squads for select
  using (auth.uid() = user_id);

create policy "Users can create own squads"
  on public.persona_squads for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own squads"
  on public.persona_squads for delete
  using (auth.uid() = user_id);
