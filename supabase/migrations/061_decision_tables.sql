-- Migration 061: decision tables for the multi-agent decision analysis tool
-- Spec: docs/superpowers/specs/2026-05-06-multi-agent-decision-tool-design.md §6.2
--
-- Reverse pivot from audit/compliance back to general decision analysis.
-- Five new tables (decision_sessions, _briefs, _messages, _mechanism_runs,
-- _findings), plus immutability trigger, RLS, and Realtime publication.
-- Audit tables stay in place; migration 062 will rename them deprecated_*.
--
-- IMPORTANT — DB conventions for this domain:
--   * `personas.id` is TEXT in production. All FK columns to personas
--     here (`persona_ids`, `cited_persona_ids`) MUST be TEXT[], not
--     UUID[]. Initial schema docs lie; check the migrations.
--   * Decision briefs become immutable post-finalize via the
--     `decision_briefs_immutable` trigger below. To "edit" a brief,
--     create a child via /rerun with parent_brief_id pointing back.
--   * One draft per session is enforced in migration 065 by a partial
--     unique index — keeps concurrent intake jobs from creating
--     duplicate drafts.

-- =====================================================================
-- decision_sessions: container for one decision conversation
-- =====================================================================
create table decision_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  workspace_id    uuid references workspaces(id) on delete set null,
  title           text,
  last_msg_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index decision_sessions_user_idx
  on decision_sessions (user_id, last_msg_at desc);

-- =====================================================================
-- decision_briefs: immutable routing contract between Intake and Orchestrator
-- =====================================================================
create table decision_briefs (
  id                         uuid primary key default gen_random_uuid(),
  session_id                 uuid not null references decision_sessions(id) on delete cascade,
  parent_brief_id            uuid references decision_briefs(id) on delete set null,

  status                     text not null default 'draft'
                               check (status in ('draft','finalized','invalidated',
                                                  'failed','partially_completed','completed')),
  sealed_by                  text
                               check (sealed_by in ('all_required_filled','user_skip',
                                                    'budget_exhausted','auto_timeout')),

  decision_type              text,
  primary_dimensions         text[] not null default '{}',
  canonical_question         text not null,

  -- TEXT[] not UUID[]: personas.id is TEXT in production
  persona_ids                text[] not null default '{}',
  mechanism_kinds            text[] not null default '{}',

  routing_extract            jsonb not null default '{}'::jsonb,
  mechanisms                 jsonb not null default '[]'::jsonb,
  question_log               jsonb not null default '[]'::jsonb,
  raw_user_messages          jsonb not null default '[]'::jsonb,

  llm_model                  text,
  prompt_version             text,
  total_intake_tokens        int default 0,
  extraction_confidence_avg  numeric(3,2),
  version                    int not null default 1,

  created_at                 timestamptz not null default now(),
  finalized_at               timestamptz,

  constraint finalized_has_seal_reason
    check (status not in ('finalized','completed','partially_completed')
           or sealed_by is not null),
  constraint finalized_has_finalized_at
    check (status not in ('finalized','completed','partially_completed')
           or finalized_at is not null)
);
create index decision_briefs_session_idx
  on decision_briefs (session_id, created_at desc);
create index decision_briefs_status_idx
  on decision_briefs (status) where status = 'draft';

-- =====================================================================
-- decision_messages: chat turns of all kinds
-- =====================================================================
create table decision_messages (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references decision_sessions(id) on delete cascade,
  kind              text not null
                      check (kind in ('user_text','user_option','user_skip_run',
                                      'agent_question','agent_confirmation',
                                      'agent_thinking','agent_artifact','system')),
  content           text,
  options           jsonb,
  brief_id          uuid references decision_briefs(id) on delete set null,
  is_ephemeral      boolean not null default false,
  created_at        timestamptz not null default now(),

  constraint artifact_has_brief
    check (kind <> 'agent_artifact' or brief_id is not null),
  constraint artifact_has_no_content
    check (kind <> 'agent_artifact' or content is null)
);
create index decision_messages_session_idx
  on decision_messages (session_id, created_at);

-- =====================================================================
-- decision_mechanism_runs: one row per (brief, mechanism)
-- =====================================================================
create table decision_mechanism_runs (
  id              uuid primary key default gen_random_uuid(),
  brief_id        uuid not null references decision_briefs(id) on delete cascade,
  kind            text not null,
  status          text not null default 'queued'
                    check (status in ('queued','running','completed','failed','skipped')),
  args            jsonb not null default '{}'::jsonb,
  raw_output      jsonb,
  error_message   text,
  attempts        int not null default 0,
  started_at      timestamptz,
  completed_at    timestamptz,
  duration_ms     int
);
create index decision_mechanism_runs_brief_idx
  on decision_mechanism_runs (brief_id);

-- =====================================================================
-- decision_findings: bullet-level output, one mechanism = one source
-- =====================================================================
create table decision_findings (
  id                  uuid primary key default gen_random_uuid(),
  brief_id            uuid not null references decision_briefs(id) on delete cascade,
  mechanism_run_id    uuid not null references decision_mechanism_runs(id) on delete cascade,
  source_mechanism    text not null,
  headline            text not null,
  severity            int not null check (severity between 1 and 5),
  confidence          numeric(3,2) not null check (confidence between 0 and 1),
  detail_summary      text not null,
  cited_persona_ids   text[] not null default '{}',
  position            int,
  content_hash        text not null,
  created_at          timestamptz not null default now()
);
create index decision_findings_brief_idx
  on decision_findings (brief_id, source_mechanism, position);
create unique index decision_findings_dedupe_idx
  on decision_findings (mechanism_run_id, content_hash);

-- =====================================================================
-- Trigger: prevent mutation of finalized brief content
-- =====================================================================
create or replace function reject_finalized_brief_mutation()
returns trigger as $$
begin
  if old.status in ('finalized','completed','partially_completed','failed')
     and (old.routing_extract    is distinct from new.routing_extract
          or old.persona_ids     is distinct from new.persona_ids
          or old.mechanisms      is distinct from new.mechanisms
          or old.canonical_question is distinct from new.canonical_question
          or old.mechanism_kinds is distinct from new.mechanism_kinds)
  then
    raise exception 'cannot mutate finalized brief content (id=%)', old.id;
  end if;
  return new;
end;
$$ language plpgsql;
create trigger decision_briefs_immutable
  before update on decision_briefs
  for each row execute function reject_finalized_brief_mutation();

-- =====================================================================
-- Trigger: prevent self-parent
-- =====================================================================
create or replace function reject_self_parent_brief()
returns trigger as $$
begin
  if new.parent_brief_id = new.id then
    raise exception 'parent_brief_id cannot equal id';
  end if;
  return new;
end;
$$ language plpgsql;
create trigger decision_briefs_no_self_parent
  before insert or update on decision_briefs
  for each row execute function reject_self_parent_brief();

-- =====================================================================
-- Realtime publication
-- =====================================================================
alter publication supabase_realtime add table decision_messages;
alter publication supabase_realtime add table decision_findings;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table decision_sessions       enable row level security;
alter table decision_messages       enable row level security;
alter table decision_briefs         enable row level security;
alter table decision_mechanism_runs enable row level security;
alter table decision_findings       enable row level security;

create policy decision_sessions_owner on decision_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy decision_messages_owner on decision_messages
  for all using (
    exists (
      select 1 from decision_sessions s
      where s.id = decision_messages.session_id and s.user_id = auth.uid()
    )
  );

create policy decision_briefs_owner on decision_briefs
  for all using (
    exists (
      select 1 from decision_sessions s
      where s.id = decision_briefs.session_id and s.user_id = auth.uid()
    )
  );

create policy decision_mechanism_runs_owner on decision_mechanism_runs
  for all using (
    exists (
      select 1 from decision_briefs b
      join decision_sessions s on s.id = b.session_id
      where b.id = decision_mechanism_runs.brief_id and s.user_id = auth.uid()
    )
  );

create policy decision_findings_owner on decision_findings
  for all using (
    exists (
      select 1 from decision_briefs b
      join decision_sessions s on s.id = b.session_id
      where b.id = decision_findings.brief_id and s.user_id = auth.uid()
    )
  );

-- =====================================================================
-- Comments for future maintainers
-- =====================================================================
comment on table decision_briefs is
  'Immutable routing contract between Intake and Orchestrator. status=finalized rows reject content mutation via trigger. parent_brief_id chains a follow-up brief to its predecessor in the same session.';
comment on table decision_findings is
  'Per-bullet output. Each finding belongs to exactly one mechanism (source_mechanism). content_hash supports stable UI reconcile.';
comment on column decision_briefs.persona_ids is
  'TEXT[] — must align with personas.id which is TEXT in production (not UUID).';
