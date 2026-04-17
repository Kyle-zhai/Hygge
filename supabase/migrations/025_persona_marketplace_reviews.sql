-- Marketplace reviews — users rate and review published (is_public) personas.
-- Distinct from evaluation-level `persona_reviews`, which is AI-generated feedback about a project.
create table if not exists persona_marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  persona_id text not null references personas(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (persona_id, author_id)
);

create index if not exists persona_marketplace_reviews_persona_idx
  on persona_marketplace_reviews (persona_id, created_at desc);

create index if not exists persona_marketplace_reviews_author_idx
  on persona_marketplace_reviews (author_id);

-- Aggregated rating view — cheap read for detail pages.
create or replace view persona_marketplace_stats as
select
  persona_id,
  count(*)::int as review_count,
  round(avg(rating)::numeric, 2) as average_rating
from persona_marketplace_reviews
group by persona_id;
