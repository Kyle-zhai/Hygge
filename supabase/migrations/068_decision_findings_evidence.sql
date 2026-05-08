-- Migration 068: decision_findings.evidence
-- Concrete backing for each finding — data points, real-company comparables,
-- studies, principles, expert positions. The synthesizer copies this from
-- the mechanism's raw_output. UI renders these as chips beneath the
-- finding so users can see WHY the agent reached the conclusion, not
-- just the conclusion itself.
--
-- Phase 3 will populate `source` with verifiable URLs from web search;
-- for now most rows will have empty source ("LLM training data; verify
-- before citing").

alter table decision_findings
  add column if not exists evidence jsonb;

comment on column decision_findings.evidence is
  'Array of FindingEvidence: [{kind: data_point|comparable|user_research|principle|expert_view, text: string, source?: string}]. Surfaced in the artifact view as auditable backing for each finding.';
