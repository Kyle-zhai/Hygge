-- Migration 065: tighten decision_briefs against concurrent drafts and
-- deep parent_brief chains.
--
-- Found in the multi-perspective audit pass: upsertDraftBrief did
-- SELECT-then-INSERT under the assumption that BullMQ jobId dedup would
-- collapse concurrent intake jobs, but a fast-double-POST from the API
-- (two different jobIds in flight) could race past the existence check
-- and create duplicate draft briefs in the same session.
--
-- This migration also adds a depth-1 ancestor check for parent_brief_id
-- to prevent /rerun loops from building up arbitrarily deep chains.
-- A future migration can swap the trigger for a recursive CTE if a
-- multi-step cycle is ever observed in production logs.

-- ─── At most one draft brief per session ─────────────────────────────
-- Partial unique index. The `status = 'draft'` predicate keeps multiple
-- finalized briefs (including parent + child rerun briefs) coexisting
-- in the same session.
create unique index if not exists decision_briefs_one_draft_per_session_idx
  on public.decision_briefs (session_id)
  where status = 'draft';

-- ─── Cap parent_brief_id chain depth ─────────────────────────────────
-- A trigger that walks the parent chain on insert/update and rejects
-- inserts whose ancestor depth would exceed MAX_DEPTH. We use 8 here:
-- generous enough to support iterative refinement of a single decision
-- but tight enough that a runaway loop is caught quickly.
create or replace function reject_deep_parent_brief_chain()
returns trigger as $$
declare
  current_id uuid := new.parent_brief_id;
  depth int := 0;
  max_depth constant int := 8;
begin
  if current_id is null then
    return new;
  end if;

  while current_id is not null and depth < max_depth + 1 loop
    depth := depth + 1;
    select parent_brief_id into current_id
    from public.decision_briefs
    where id = current_id;
  end loop;

  if depth > max_depth then
    raise exception 'parent_brief_id chain exceeds max depth of %', max_depth;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists decision_briefs_max_chain_depth on public.decision_briefs;
create trigger decision_briefs_max_chain_depth
  before insert or update of parent_brief_id on public.decision_briefs
  for each row execute function reject_deep_parent_brief_chain();

comment on index public.decision_briefs_one_draft_per_session_idx is
  'At most one draft brief per session — closes the upsertDraftBrief TOCTOU window flagged in the 2026-05-07 audit.';
comment on function public.reject_deep_parent_brief_chain() is
  'Caps parent_brief_id chains at depth 8 to prevent /rerun runaway loops.';
