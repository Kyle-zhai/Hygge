-- Bring-your-own-key (BYOK) settings for OpenAI-compatible LLM providers.
-- Each user gets one row; the worker reads via service role and uses these
-- values to override the default Qwen config at evaluation time.
create table if not exists user_llm_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider_label text,
  base_url text not null,
  model text not null,
  vision_model text,
  api_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_llm_settings enable row level security;

-- Users can only read/write their own row. Service role bypasses RLS.
create policy "user_llm_settings_self_select"
  on user_llm_settings for select
  using (auth.uid() = user_id);

create policy "user_llm_settings_self_insert"
  on user_llm_settings for insert
  with check (auth.uid() = user_id);

create policy "user_llm_settings_self_update"
  on user_llm_settings for update
  using (auth.uid() = user_id);

create policy "user_llm_settings_self_delete"
  on user_llm_settings for delete
  using (auth.uid() = user_id);
