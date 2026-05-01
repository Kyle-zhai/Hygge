// tavily-client.ts
//
// Multi-agent audit kernel: thin wrapper around Tavily search with
// (a) cache lookup keyed on sha256(canonical(query + sorted domains + depth)),
// (b) hit_count increment via audit_search_cache_record_hit RPC,
// (c) 7-day freshness window — older rows still return cached results but the
//     synthesizer uses last_verified_at to flag stale citations downstream.
// Spec: docs/superpowers/specs/2026-04-30-multi-agent-audit-architecture.md §10

import { supabase } from "../supabase.js";
import { canonicalJson, sha256Hex } from "./hash-chain.js";
import { log } from "../utils/logger.js";

export interface TavilySearchOpts {
  query: string;
  domains: string[];
  maxResults?: number;
  searchDepth?: "basic" | "advanced";
  includeRawContent?: boolean;
}

export interface TavilyResult {
  url: string;
  title: string;
  snippet: string;
  content?: string;
  score?: number;
  published_at?: string | null;
}

export interface TavilyCacheRecord {
  cacheId: string;
  fromCache: boolean;
  fetchedAt: string;
  lastVerifiedAt: string;
  results: TavilyResult[];
}

const FRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function tavilyEnabled(): boolean {
  return !!process.env.TAVILY_API_KEY;
}

function buildQueryHash(query: string, domains: string[], depth: "basic" | "advanced"): string {
  // Domains are sorted so callers don't need to canonicalize order themselves.
  const sortedDomains = [...domains].map((d) => d.trim().toLowerCase()).filter(Boolean).sort();
  return sha256Hex(canonicalJson({ q: query.trim(), d: sortedDomains, depth }));
}

interface CachedRow {
  id: string;
  results: TavilyResult[];
  fetched_at: string;
  last_verified_at: string;
}

async function loadFromCache(queryHash: string): Promise<CachedRow | null> {
  const { data, error } = await supabase
    .from("audit_search_cache")
    .select("id, results, fetched_at, last_verified_at")
    .eq("query_hash", queryHash)
    .maybeSingle();
  if (error) {
    log.warn("tavily.cache_lookup_failed", { error: error.message });
    return null;
  }
  return (data as CachedRow | null) ?? null;
}

async function recordHit(queryHash: string): Promise<void> {
  const { error } = await supabase.rpc("audit_search_cache_record_hit", {
    p_query_hash: queryHash,
  });
  if (error) {
    log.warn("tavily.cache_hit_increment_failed", { error: error.message });
  }
}

async function storeInCache(args: {
  queryHash: string;
  query: string;
  domains: string[];
  depth: "basic" | "advanced";
  results: TavilyResult[];
}): Promise<string | null> {
  const earliest = pickEarliestPublishedAt(args.results);
  const row = {
    query_hash: args.queryHash,
    query_text: args.query.slice(0, 4000),
    source_domains: args.domains,
    results: args.results,
    source_published_at: earliest,
    search_depth: args.depth,
  };
  const { data, error } = await supabase
    .from("audit_search_cache")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) {
    log.warn("tavily.cache_insert_failed", { error: error.message });
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
}

function pickEarliestPublishedAt(results: TavilyResult[]): string | null {
  let earliest: number | null = null;
  for (const r of results) {
    const t = r.published_at ? Date.parse(r.published_at) : NaN;
    if (Number.isFinite(t)) {
      earliest = earliest === null ? t : Math.min(earliest, t);
    }
  }
  return earliest === null ? null : new Date(earliest).toISOString();
}

interface TavilyApiResponse {
  results?: Array<{
    url?: string;
    title?: string;
    content?: string;
    raw_content?: string;
    score?: number;
    published_date?: string | null;
    snippet?: string;
  }>;
  query?: string;
  answer?: string;
}

function normalizeApiResults(raw: TavilyApiResponse["results"]): TavilyResult[] {
  if (!Array.isArray(raw)) return [];
  const out: TavilyResult[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const url = typeof r.url === "string" ? r.url.trim() : "";
    if (!url) continue;
    const snippet = typeof r.snippet === "string" && r.snippet.trim()
      ? r.snippet
      : typeof r.content === "string" ? r.content.slice(0, 1500) : "";
    out.push({
      url,
      title: typeof r.title === "string" ? r.title.slice(0, 500) : "",
      snippet: snippet.slice(0, 4000),
      content: typeof r.raw_content === "string" ? r.raw_content.slice(0, 16000) : undefined,
      score: typeof r.score === "number" ? r.score : undefined,
      published_at: typeof r.published_date === "string" ? r.published_date : null,
    });
  }
  return out;
}

async function callTavilyApi(opts: TavilySearchOpts): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY is not set");
  const baseUrl = (process.env.TAVILY_BASE_URL || "https://api.tavily.com").replace(/\/$/, "");

  const body: Record<string, unknown> = {
    api_key: apiKey,
    query: opts.query,
    search_depth: opts.searchDepth ?? "basic",
    max_results: Math.min(Math.max(opts.maxResults ?? 8, 1), 10),
    include_answer: false,
    include_raw_content: !!opts.includeRawContent,
  };
  if (opts.domains.length > 0) body.include_domains = opts.domains;

  const controller = new AbortController();
  const timeoutMs = Number(process.env.TAVILY_TIMEOUT_MS ?? 20000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Tavily search failed: ${res.status} ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as TavilyApiResponse;
    return normalizeApiResults(json.results);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run a Tavily search with cache. Always returns a TavilyCacheRecord — even
 * cache misses produce a record so callers can attach search_cache_ids to
 * findings. Caller should treat empty results[] as "no authoritative source
 * found" (don't abort the audit).
 */
export async function tavilySearch(opts: TavilySearchOpts): Promise<TavilyCacheRecord> {
  const depth = opts.searchDepth ?? "basic";
  const queryHash = buildQueryHash(opts.query, opts.domains, depth);

  if (!tavilyEnabled()) {
    log.warn("tavily.disabled_no_api_key", { queryHash });
    // Allow the kernel to keep running without Tavily — Layer 3 personas
    // will see empty results[] and emit a "no authoritative source found"
    // finding. This is what we want in dev / preview deployments.
    return {
      cacheId: "",
      fromCache: false,
      fetchedAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
      results: [],
    };
  }

  const cached = await loadFromCache(queryHash);
  const now = Date.now();
  if (cached) {
    const fetchedTs = Date.parse(cached.fetched_at);
    const fresh = Number.isFinite(fetchedTs) && now - fetchedTs < FRESH_TTL_MS;
    if (fresh) {
      await recordHit(queryHash);
      log.info("tavily.cache_hit", {
        queryHash,
        ageMs: now - fetchedTs,
        resultCount: cached.results?.length ?? 0,
      });
      return {
        cacheId: cached.id,
        fromCache: true,
        fetchedAt: cached.fetched_at,
        lastVerifiedAt: cached.last_verified_at,
        results: Array.isArray(cached.results) ? cached.results : [],
      };
    }
    // Stale: re-fetch but keep the same id behavior — we just write a new row
    // because (query_hash) is unique. We can't reuse the cached row via
    // upsert without losing hit_count; cleaner to mark the old one as stale
    // by overwriting it. Use upsert on conflict.
    log.info("tavily.cache_stale", { queryHash, ageMs: now - fetchedTs });
  }

  let results: TavilyResult[] = [];
  try {
    results = await callTavilyApi(opts);
  } catch (err) {
    log.error("tavily.api_failed", {
      queryHash,
      error: err instanceof Error ? err.message : String(err),
    });
    if (cached) {
      // API failed but we have a stale row — return it so the persona can
      // still cite something. The synthesizer will flag staleness via
      // last_verified_at.
      return {
        cacheId: cached.id,
        fromCache: true,
        fetchedAt: cached.fetched_at,
        lastVerifiedAt: cached.last_verified_at,
        results: Array.isArray(cached.results) ? cached.results : [],
      };
    }
    return {
      cacheId: "",
      fromCache: false,
      fetchedAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
      results: [],
    };
  }

  let cacheId: string | null = null;
  if (cached) {
    // Stale row — refresh in place. last_verified_at is reset to now() by the
    // update path so the synthesizer sees freshly-verified content.
    const { data, error } = await supabase
      .from("audit_search_cache")
      .update({
        query_text: opts.query.slice(0, 4000),
        source_domains: opts.domains,
        results,
        source_published_at: pickEarliestPublishedAt(results),
        search_depth: depth,
        fetched_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
      })
      .eq("id", cached.id)
      .select("id")
      .maybeSingle();
    if (error) {
      log.warn("tavily.cache_refresh_failed", { error: error.message });
    } else {
      cacheId = (data as { id: string } | null)?.id ?? cached.id;
    }
  } else {
    cacheId = await storeInCache({
      queryHash,
      query: opts.query,
      domains: opts.domains,
      depth,
      results,
    });
  }

  return {
    cacheId: cacheId ?? "",
    fromCache: false,
    fetchedAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    results,
  };
}

// Exported for tests — pure functions only.
export const __test__ = {
  buildQueryHash,
  pickEarliestPublishedAt,
  normalizeApiResults,
};
