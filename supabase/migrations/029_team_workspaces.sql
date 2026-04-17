-- Team workspaces — lets multiple users collaborate on shared evaluations.
-- A project can optionally belong to a workspace; all workspace members then
-- see the project and its evaluations via existing cascading RLS.

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists workspaces_owner_idx on workspaces (owner_id);

create table if not exists workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  added_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on workspace_members (user_id);
create index if not exists workspace_members_workspace_idx on workspace_members (workspace_id);

alter table projects
  add column if not exists workspace_id uuid references workspaces(id) on delete set null;

create index if not exists projects_workspace_idx on projects (workspace_id);

-- ============================================================================
-- RLS for workspaces / members
-- ============================================================================
alter table workspaces enable row level security;
alter table workspace_members enable row level security;

-- A user sees a workspace if they are a member of it.
drop policy if exists "workspaces_member_select" on workspaces;
create policy "workspaces_member_select"
  on workspaces for select
  using (
    id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- Only the owner can update/delete a workspace; anyone authenticated can create.
drop policy if exists "workspaces_owner_insert" on workspaces;
create policy "workspaces_owner_insert"
  on workspaces for insert
  with check (auth.uid() = owner_id);

drop policy if exists "workspaces_owner_update" on workspaces;
create policy "workspaces_owner_update"
  on workspaces for update
  using (auth.uid() = owner_id);

drop policy if exists "workspaces_owner_delete" on workspaces;
create policy "workspaces_owner_delete"
  on workspaces for delete
  using (auth.uid() = owner_id);

-- Members can see the roster of any workspace they belong to.
drop policy if exists "workspace_members_self_view" on workspace_members;
create policy "workspace_members_self_view"
  on workspace_members for select
  using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- Owners manage membership; users can remove themselves.
drop policy if exists "workspace_members_owner_insert" on workspace_members;
create policy "workspace_members_owner_insert"
  on workspace_members for insert
  with check (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
    or user_id = auth.uid()
  );

drop policy if exists "workspace_members_owner_or_self_delete" on workspace_members;
create policy "workspace_members_owner_or_self_delete"
  on workspace_members for delete
  using (
    user_id = auth.uid()
    or workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- ============================================================================
-- Extend existing resource policies to allow workspace members
-- ============================================================================
drop policy if exists "Users can view own projects" on public.projects;
create policy "projects_view_self_or_workspace"
  on public.projects for select
  using (
    auth.uid() = user_id
    or (
      workspace_id is not null
      and workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
    )
  );

drop policy if exists "Users can view own evaluations" on public.evaluations;
create policy "evaluations_view_via_project"
  on public.evaluations for select
  using (
    project_id in (
      select id from public.projects
      where user_id = auth.uid()
         or (workspace_id is not null
             and workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
    )
  );

drop policy if exists "Users can view own persona reviews" on public.persona_reviews;
create policy "persona_reviews_view_via_project"
  on public.persona_reviews for select
  using (
    evaluation_id in (
      select e.id from public.evaluations e
      join public.projects p on e.project_id = p.id
      where p.user_id = auth.uid()
         or (p.workspace_id is not null
             and p.workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
    )
  );

drop policy if exists "Users can view own summary reports" on public.summary_reports;
create policy "summary_reports_view_via_project"
  on public.summary_reports for select
  using (
    evaluation_id in (
      select e.id from public.evaluations e
      join public.projects p on e.project_id = p.id
      where p.user_id = auth.uid()
         or (p.workspace_id is not null
             and p.workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
    )
  );
