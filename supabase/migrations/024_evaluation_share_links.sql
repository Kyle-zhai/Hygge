-- Public read-only share links for completed evaluations.
-- Token-based: owner generates a URL; anyone with the token can read the report.
alter table evaluations
  add column if not exists share_token text,
  add column if not exists shared_at timestamptz;

create unique index if not exists evaluations_share_token_key
  on evaluations (share_token)
  where share_token is not null;

create index if not exists evaluations_share_token_idx
  on evaluations (share_token)
  where share_token is not null;
