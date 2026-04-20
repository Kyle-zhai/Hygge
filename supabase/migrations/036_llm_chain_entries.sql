-- Bring-your-own-key chain: each user can save an ordered list of LLM providers
-- that the worker tries in order. Replaces the single-row user_llm_settings table
-- so users can mix providers (e.g. "qwen3.6-plus on dashscope first, qwen3-32b second,
-- claude-sonnet as last-resort").

create table if not exists user_llm_chain_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_index int not null,
  provider_type text not null default 'openai_compatible',
  label text,
  base_url text,
  model text not null,
  vision_model text,
  api_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_llm_chain_entries_provider_type_check
    check (provider_type in ('openai_compatible', 'anthropic', 'google')),
  constraint user_llm_chain_entries_order_index_nonneg
    check (order_index >= 0),
  unique (user_id, order_index)
);

create index if not exists user_llm_chain_entries_user_order_idx
  on user_llm_chain_entries (user_id, order_index);

alter table user_llm_chain_entries enable row level security;

create policy "user_llm_chain_self_select"
  on user_llm_chain_entries for select
  using (auth.uid() = user_id);

create policy "user_llm_chain_self_insert"
  on user_llm_chain_entries for insert
  with check (auth.uid() = user_id);

create policy "user_llm_chain_self_update"
  on user_llm_chain_entries for update
  using (auth.uid() = user_id);

create policy "user_llm_chain_self_delete"
  on user_llm_chain_entries for delete
  using (auth.uid() = user_id);

-- Old single-row BYOK table is retired. Users were told their settings would be
-- cleared; drop so fetchEffectivePlan can stop joining it and the schema stays clean.
drop table if exists user_llm_settings cascade;
