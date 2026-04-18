-- Fix: "infinite recursion detected in policy for relation workspace_members"
--
-- The original 029 policies on workspace_members / workspaces referenced
-- workspace_members in their USING clause, which triggered their own policy
-- evaluation recursively. Any query that transitively hit projects or
-- evaluations RLS (e.g. loading personas in the evaluator) crashed.
--
-- Solution: move the "workspace IDs this user belongs to" lookup into a
-- SECURITY DEFINER function. The function runs with the definer's privileges,
-- bypassing RLS on the workspace_members lookup and breaking the recursion.

create or replace function public.user_workspace_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select workspace_id from public.workspace_members where user_id = auth.uid();
$$;

create or replace function public.user_owned_workspace_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.workspaces where owner_id = auth.uid();
$$;

grant execute on function public.user_workspace_ids() to authenticated;
grant execute on function public.user_owned_workspace_ids() to authenticated;

-- ============================================================================
-- Rewrite policies to use the helper functions
-- ============================================================================

-- workspaces: a user sees a workspace if they belong to it (or own it)
drop policy if exists "workspaces_member_select" on public.workspaces;
create policy "workspaces_member_select"
  on public.workspaces for select
  using (
    owner_id = auth.uid()
    or id in (select public.user_workspace_ids())
  );

-- workspace_members: user sees their own membership row, plus roster of
-- workspaces they belong to. No more self-reference in the subquery.
drop policy if exists "workspace_members_self_view" on public.workspace_members;
create policy "workspace_members_self_view"
  on public.workspace_members for select
  using (
    user_id = auth.uid()
    or workspace_id in (select public.user_workspace_ids())
  );

drop policy if exists "workspace_members_owner_insert" on public.workspace_members;
create policy "workspace_members_owner_insert"
  on public.workspace_members for insert
  with check (
    user_id = auth.uid()
    or workspace_id in (select public.user_owned_workspace_ids())
  );

drop policy if exists "workspace_members_owner_or_self_delete" on public.workspace_members;
create policy "workspace_members_owner_or_self_delete"
  on public.workspace_members for delete
  using (
    user_id = auth.uid()
    or workspace_id in (select public.user_owned_workspace_ids())
  );

-- Downstream resource policies that joined workspace_members directly now
-- delegate to the function, removing their transitive recursion path.
drop policy if exists "projects_view_self_or_workspace" on public.projects;
create policy "projects_view_self_or_workspace"
  on public.projects for select
  using (
    auth.uid() = user_id
    or (
      workspace_id is not null
      and workspace_id in (select public.user_workspace_ids())
    )
  );

drop policy if exists "evaluations_view_via_project" on public.evaluations;
create policy "evaluations_view_via_project"
  on public.evaluations for select
  using (
    project_id in (
      select id from public.projects
      where user_id = auth.uid()
         or (workspace_id is not null
             and workspace_id in (select public.user_workspace_ids()))
    )
  );

drop policy if exists "persona_reviews_view_via_project" on public.persona_reviews;
create policy "persona_reviews_view_via_project"
  on public.persona_reviews for select
  using (
    evaluation_id in (
      select e.id from public.evaluations e
      join public.projects p on e.project_id = p.id
      where p.user_id = auth.uid()
         or (p.workspace_id is not null
             and p.workspace_id in (select public.user_workspace_ids()))
    )
  );

drop policy if exists "summary_reports_view_via_project" on public.summary_reports;
create policy "summary_reports_view_via_project"
  on public.summary_reports for select
  using (
    evaluation_id in (
      select e.id from public.evaluations e
      join public.projects p on e.project_id = p.id
      where p.user_id = auth.uid()
         or (p.workspace_id is not null
             and p.workspace_id in (select public.user_workspace_ids()))
    )
  );
