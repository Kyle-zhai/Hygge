-- Per-user thumbs-up/down on specific persona reviews.
-- Feeds into adaptive ranking in the persona selector — personas whose
-- reviews the user has liked float to the top next time.
create table if not exists persona_review_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  persona_id text not null references personas(id) on delete cascade,
  review_id uuid not null references persona_reviews(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (user_id, review_id)
);

create index if not exists persona_review_feedback_user_persona_idx
  on persona_review_feedback (user_id, persona_id);

-- Aggregate net preference per user x persona.
create or replace view persona_user_preferences as
select
  user_id,
  persona_id,
  sum(value)::int as net_score,
  count(*)::int as vote_count
from persona_review_feedback
group by user_id, persona_id;

alter table persona_review_feedback enable row level security;

create policy "persona_review_feedback_self_select"
  on persona_review_feedback for select
  using (auth.uid() = user_id);

create policy "persona_review_feedback_self_write"
  on persona_review_feedback for insert
  with check (auth.uid() = user_id);

create policy "persona_review_feedback_self_update"
  on persona_review_feedback for update
  using (auth.uid() = user_id);

create policy "persona_review_feedback_self_delete"
  on persona_review_feedback for delete
  using (auth.uid() = user_id);
