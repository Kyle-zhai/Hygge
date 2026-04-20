-- Per-entry enabled toggle so users can pause BYOK without losing saved keys.
-- When every entry is disabled, effective plan falls back to subscription tier.
alter table user_llm_chain_entries
  add column if not exists enabled boolean not null default true;

create index if not exists user_llm_chain_entries_user_enabled_idx
  on user_llm_chain_entries (user_id, enabled);
