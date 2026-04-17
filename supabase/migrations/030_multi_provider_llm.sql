-- Extend user_llm_settings to support providers beyond OpenAI-compatible:
-- anthropic (Claude native messages API) and google (Gemini generateContent).
-- The column has a default so existing rows keep working without migration.
alter table user_llm_settings
  add column if not exists provider_type text not null default 'openai_compatible';

alter table user_llm_settings
  drop constraint if exists user_llm_settings_provider_type_check;

alter table user_llm_settings
  add constraint user_llm_settings_provider_type_check
  check (provider_type in ('openai_compatible', 'anthropic', 'google'));

-- base_url is provider-default for anthropic/google; allow empty string to
-- signal "use the provider's default endpoint" without breaking the NOT NULL
-- constraint from the original migration.
alter table user_llm_settings
  alter column base_url drop not null;
