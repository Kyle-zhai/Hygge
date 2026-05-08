// Tavily-backed web search for grounding decision analysis in real-world
// data. Tavily's API is cheap (~$0.001 / search), JSON-native, and tuned
// for LLM consumption — short snippets, no scraping HTML.
//
// Behaviour when TAVILY_API_KEY is missing: returns an empty result set
// and logs a warning. The mechanism prompts gracefully fall back to
// "principle"-kind evidence when no real-world data is available, so a
// missing key degrades quality but doesn't break the flow.

import { log } from "../utils/logger.js";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  // Tavily returns a 0-1 relevance score; we keep it for ranking when
  // we merge results across multiple queries on the same brief.
  score?: number;
  query: string;
}

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const TIMEOUT_MS = 10_000;
const MAX_RESULTS_PER_QUERY = 5;

export async function tavilySearch(query: string): Promise<WebSearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    log.warn("web_search.no_api_key", {
      message: "TAVILY_API_KEY missing — web search disabled, falling back to LLM training data",
    });
    return [];
  }

  if (!query || query.trim().length === 0) return [];

  let response: Response;
  try {
    response = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: query.slice(0, 400),
        search_depth: "basic",
        max_results: MAX_RESULTS_PER_QUERY,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    log.warn("web_search.network_error", {
      query: query.slice(0, 100),
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    log.warn("web_search.http_error", {
      query: query.slice(0, 100),
      status: response.status,
      body: body.slice(0, 200),
    });
    return [];
  }

  let data: { results?: Array<Record<string, unknown>> };
  try {
    data = (await response.json()) as { results?: Array<Record<string, unknown>> };
  } catch (err) {
    log.warn("web_search.parse_error", {
      query: query.slice(0, 100),
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  const raw = Array.isArray(data.results) ? data.results : [];
  const results: WebSearchResult[] = [];
  for (const r of raw) {
    const title = typeof r.title === "string" ? r.title : "";
    const url = typeof r.url === "string" ? r.url : "";
    const snippet =
      typeof r.content === "string"
        ? r.content
        : typeof r.snippet === "string"
          ? r.snippet
          : "";
    if (!url || !title) continue;
    const item: WebSearchResult = {
      title: title.slice(0, 200),
      url,
      snippet: snippet.slice(0, 600),
      query,
    };
    if (typeof r.score === "number") item.score = r.score;
    results.push(item);
  }

  log.info("web_search.ok", {
    query: query.slice(0, 100),
    resultCount: results.length,
  });
  return results;
}

// Deduplicate results across multiple queries by URL — the same article
// often surfaces for related queries, and we don't want to spam the
// mechanism prompt with copies of the same source.
export function dedupeByUrl(lists: WebSearchResult[][]): WebSearchResult[] {
  const seen = new Set<string>();
  const merged: WebSearchResult[] = [];
  for (const list of lists) {
    for (const r of list) {
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      merged.push(r);
    }
  }
  // Sort by score desc when available so the strongest matches surface
  // first to the mechanism LLM.
  merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return merged;
}
