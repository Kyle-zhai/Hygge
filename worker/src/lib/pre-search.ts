// Pre-search step: at intake-seal time, an aux LLM picks 3–5 search
// queries that would surface real-world data for this decision (real
// company comparables, market stats, pricing benchmarks, regulation
// references). Results are de-duped, capped, and persisted on the brief
// as `web_evidence` so all mechanism processors share the same set
// without re-searching.

import type { LLMAdapter } from "../llm/adapter.js";
import type { RoutingExtract } from "../types/decision.js";
import { robustJsonParse } from "../utils/json-parse.js";
import { log } from "../utils/logger.js";
import { tavilySearch, dedupeByUrl, type WebSearchResult } from "./web-search.js";

export interface BriefWebEvidence {
  // Raw search results, one per URL after dedupe. Capped at 12 to keep
  // mechanism prompts under their token budget.
  results: WebSearchResult[];
  // The queries the LLM picked, persisted for debugging — lets a future
  // session reproduce the search if results disappear.
  queries: string[];
  // ISO timestamp of when the search ran. Older snapshots can be flagged
  // stale by the UI ("data fetched 7 days ago").
  fetched_at: string;
  // Whether search ran at all. False when TAVILY_API_KEY is missing or
  // every query failed — the mechanism processor can fall back to
  // training-data evidence instead of pretending we have web results.
  ok: boolean;
}

const QUERY_PICKER_SYSTEM = `You pick web search queries to ground a decision analysis in real-world data. Given the user's decision question and routing context, output 3-5 search queries that would surface concrete market data, real-company comparables, pricing benchmarks, regulation references, or empirical research relevant to the decision.

Prefer queries that find SPECIFIC numbers, NAMED companies, or PRIMARY sources. Avoid queries that would return generic blog posts or AI-generated listicles.

Examples of strong queries:
- "Notion Pro pricing 2025"
- "SaaS gross margin benchmarks B2B"
- "PLG to sales-led pivot case studies churn"
- "creator economy Substack vs Patreon revenue split"

Examples of weak queries (don't produce these):
- "is X a good idea"
- "tips for X"
- "everything about X"

Output strict JSON:
{
  "queries": ["<query 1>", "<query 2>", "<query 3>"]
}`;

const MAX_QUERIES = 5;
const MAX_TOTAL_RESULTS = 12;

export async function buildBriefWebEvidence(
  llm: LLMAdapter,
  canonicalQuestion: string,
  routing: RoutingExtract,
): Promise<BriefWebEvidence> {
  const fetchedAt = new Date().toISOString();

  if (!process.env.TAVILY_API_KEY) {
    return { results: [], queries: [], fetched_at: fetchedAt, ok: false };
  }

  const routingSummary = `decision_type: ${routing.decision_type.value}
primary_dimensions: ${routing.primary_dimensions.value.join(", ") || "(none)"}
stakeholders: ${routing.stakeholders.value.join(", ") || "(none)"}
constraints: ${routing.constraints.value.join(", ") || "(none)"}
alternatives: ${routing.alternatives.value.join(", ") || "(none)"}`;

  let queries: string[] = [];
  try {
    const response = await llm.complete({
      system: QUERY_PICKER_SYSTEM,
      prompt: `Decision question: ${canonicalQuestion}\n\nRouting context:\n${routingSummary}\n\nPick search queries.`,
      maxTokens: 512,
      jsonMode: true,
    });
    const parsed = robustJsonParse<{ queries?: unknown }>(response.text);
    if (Array.isArray(parsed.queries)) {
      queries = parsed.queries
        .filter((q): q is string => typeof q === "string")
        .map((q) => q.trim())
        .filter((q) => q.length > 0)
        .slice(0, MAX_QUERIES);
    }
  } catch (err) {
    log.warn("pre_search.query_pick_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { results: [], queries: [], fetched_at: fetchedAt, ok: false };
  }

  if (queries.length === 0) {
    return { results: [], queries: [], fetched_at: fetchedAt, ok: false };
  }

  // Run all searches in parallel; partial failures are tolerated — each
  // failed query just contributes [] to the merged set.
  const lists = await Promise.all(queries.map((q) => tavilySearch(q)));
  const merged = dedupeByUrl(lists).slice(0, MAX_TOTAL_RESULTS);

  log.info("pre_search.completed", {
    queryCount: queries.length,
    resultCount: merged.length,
  });

  return {
    results: merged,
    queries,
    fetched_at: fetchedAt,
    ok: merged.length > 0,
  };
}

// Format the web evidence as a prompt block that the mechanism LLM
// reads as additional context. Each result is shown with its URL so the
// mechanism's findings can cite the source by URL in `evidence[].source`.
export function formatWebEvidenceForPrompt(evidence: BriefWebEvidence): string {
  if (!evidence.ok || evidence.results.length === 0) return "";

  const items = evidence.results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}
URL: ${r.url}
Excerpt: ${r.snippet}`,
    )
    .join("\n\n");

  return `Real-world web evidence (fetched ${evidence.fetched_at.slice(0, 10)}):

${items}

When a finding's claim is supported by one of these sources, include it in finding.evidence with kind="data_point" or "comparable" and source="<the URL above>". Cite the URL exactly as shown — do NOT fabricate URLs. If the source contradicts your reasoning, prefer the source over your priors and revise the finding.`;
}
