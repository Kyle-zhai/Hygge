-- Migration 069: decision_briefs.web_evidence
-- Web search results gathered at intake-seal time (Phase 3 grounding).
-- The mechanism processor reads from here instead of re-searching per
-- mechanism — one search per brief, shared across all personas.
--
-- Shape: BriefWebEvidence from worker/src/lib/pre-search.ts:
--   { results: [{title, url, snippet, score?, query}], queries: string[],
--     fetched_at: ISO, ok: bool }

alter table decision_briefs
  add column if not exists web_evidence jsonb;

comment on column decision_briefs.web_evidence is
  'Web search snapshot taken when this brief was sealed. Mechanism processors inject these as context so findings can cite real sources. Empty/null means TAVILY_API_KEY missing or every search failed — mechanisms then fall back to LLM training data.';
