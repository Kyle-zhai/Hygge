-- 052_audit_search_cache.sql
--
-- Multi-agent audit kernel: Tavily search results cache.
-- Spec: docs/superpowers/specs/2026-04-30-multi-agent-audit-architecture.md §10
--
-- Why a cache:
--   - Tavily costs ~$0.005 per query; same legal questions repeat across users.
--   - Target hit rate: 30%, dropping per-audit cost from ~$0.13 to ~$0.08.
-- Why staleness tracking:
--   - Statutes and agency guidance change. Cached "settled" interpretation
--     can rot. Synthesizer (Layer 5) flags any finding referencing a cache
--     row whose last_verified_at is >90 days old.
--
-- This is service-role-only data (worker reads/writes). No RLS policies are
-- granted to the authenticated role — clients never query this table directly.

set client_min_messages to warning;

-- ============================================
-- audit_search_cache
-- ============================================
create table if not exists public.audit_search_cache (
  id uuid primary key default gen_random_uuid(),

  -- Stable hash of (query, sorted_domains). Same query+whitelist = same row.
  query_hash text not null unique,
  query_text text not null,
  source_domains text[] not null,

  -- Tavily results envelope.
  -- Shape: [{ url, title, snippet, content?, score, published_date }]
  results jsonb not null,

  -- Earliest published_date across results (used for stale signaling at the
  -- finding level when the source itself is recent or old).
  source_published_at timestamptz,

  fetched_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  hit_count int not null default 1,

  -- Optional: which Tavily search depth was used (basic|advanced)
  search_depth text default 'basic'
    check (search_depth in ('basic','advanced'))
);

create index if not exists audit_search_cache_verified_idx
  on public.audit_search_cache (last_verified_at);

create index if not exists audit_search_cache_fetched_idx
  on public.audit_search_cache (fetched_at);

-- ============================================
-- Helper: increment hit_count on cache reuse
-- ============================================
create or replace function public.audit_search_cache_record_hit(
  p_query_hash text
) returns void
language sql
security definer
set search_path = public
as $$
  update public.audit_search_cache
  set hit_count = hit_count + 1,
      last_verified_at = case
        -- only refresh last_verified_at on hits within the freshness window;
        -- hits to an already-stale row don't make it less stale.
        when last_verified_at >= now() - interval '7 days'
          then now()
        else last_verified_at
      end
  where query_hash = p_query_hash;
$$;

revoke all on function public.audit_search_cache_record_hit(text) from public;
-- service role only; not granted to authenticated.

-- ============================================
-- RLS — service-role only (no policies = no authenticated access)
-- ============================================
alter table public.audit_search_cache enable row level security;

-- No SELECT/INSERT/UPDATE/DELETE policies for authenticated.
-- Service role bypasses RLS, so the worker can read/write freely.
