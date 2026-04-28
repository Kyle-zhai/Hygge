/**
 * Route handler tests for /api/feedback/utterance
 *
 * These tests mock @/lib/supabase/server and @/lib/rate-limit so the
 * handler can be imported without a real Next.js request context.
 *
 * Test matrix (ownership checks — the main focus of the fixes):
 *   A1: POST round_table with non-existent evaluation_id  → 404
 *   A2: POST round_table with another user's evaluation_id → 403
 *   A3: POST round_table with own evaluation_id           → 200
 *   B1: POST 1v1 with non-existent debate_message_id      → 404
 *   B2: POST 1v1 with another user's debate_message_id    → 403
 *   C1: GET debateId where debate_messages query errors   → 500
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── constants ──────────────────────────────────────────────────────────────
const CALLER_ID   = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ID    = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EVAL_ID     = "11111111-1111-1111-1111-111111111111";
const PROJECT_ID  = "22222222-2222-2222-2222-222222222222";
const DM_ID       = "33333333-3333-4333-8333-333333333333";
const DEBATE_ID   = "44444444-4444-4444-8444-444444444444";

// ── supabase mock factory ──────────────────────────────────────────────────
/**
 * Returns a minimal supabase-like object that the route handler calls.
 * Each scenario overrides specific query results via the `overrides` map.
 *
 * Shape called by route:
 *   supabase.auth.getUser()
 *   supabase.from(table).select(...).eq(...).single()  → { data, error }
 *   supabase.from(table).select(...).eq(...).in(...)   → { data, error }
 *   supabase.from(table).upsert(...).select().single() → { data, error }
 */
function makeSupabase(opts: {
  userId?: string | null;
  evaluationRow?: object | null;
  projectRow?: { user_id: string } | null;
  dmRow?: { debate_id: string } | null;
  debateRow?: { user_id: string } | null;
  upsertResult?: { data: object | null; error: object | null };
  getMessageIdsResult?: { data: object[] | null; error: object | null };
}) {
  const {
    userId = CALLER_ID,
    evaluationRow = { id: EVAL_ID, project_id: PROJECT_ID },
    projectRow = { user_id: CALLER_ID },
    dmRow = { debate_id: DEBATE_ID },
    debateRow = { user_id: CALLER_ID },
    upsertResult = { data: { id: "ff", rating: 1 }, error: null },
    getMessageIdsResult = { data: [{ id: DM_ID }], error: null },
  } = opts;

  // Chainable query builder — each method returns `this` until the terminal
  // call (.single() / implicit await returning { data, error }).
  const makeChain = (finalResult: { data: unknown; error: unknown }) => {
    const chain: Record<string, unknown> = {};
    const noop = () => chain;
    chain.select   = noop;
    chain.eq       = noop;
    chain.in       = noop;
    chain.upsert   = () => chain;
    chain.single   = () => Promise.resolve(finalResult);
    // make the chain itself thenable so `await chain` returns finalResult
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(finalResult).then(resolve);
    return chain;
  };

  return {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: userId ? { id: userId } : null } }),
    },
    from: (table: string) => {
      if (table === "evaluations") {
        return makeChain({ data: evaluationRow, error: evaluationRow === null ? { message: "not found" } : null });
      }
      if (table === "projects") {
        return makeChain({ data: projectRow, error: null });
      }
      if (table === "debate_messages" && opts.getMessageIdsResult !== undefined) {
        // GET path: getMessageIds
        return makeChain(getMessageIdsResult);
      }
      if (table === "debate_messages") {
        // POST 1v1 path: single() to look up debate_id
        return makeChain({ data: dmRow, error: dmRow === null ? { message: "not found" } : null });
      }
      if (table === "debates") {
        return makeChain({ data: debateRow, error: null });
      }
      if (table === "persona_utterance_feedback") {
        // upsert path
        const chain = makeChain(upsertResult);
        return chain;
      }
      return makeChain({ data: null, error: null });
    },
  };
}

// ── module mock setup ──────────────────────────────────────────────────────
// We hold a mutable reference so each test can inject its own supabase.
let _supabaseMock: ReturnType<typeof makeSupabase>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(_supabaseMock),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: () => Promise.resolve(null),
}));

// ── helpers ────────────────────────────────────────────────────────────────
function makePostRequest(body: object): Request {
  return new Request("http://localhost/api/feedback/utterance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(params: Record<string, string>): Request {
  const url = new URL("http://localhost/api/feedback/utterance");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString(), { method: "GET" });
}

// ── tests ──────────────────────────────────────────────────────────────────
describe("POST /api/feedback/utterance — round_table ownership", () => {
  const validRoundTableBody = {
    kind: "round_table",
    evaluationId: EVAL_ID,
    roundNumber: 1,
    messageIndex: 0,
    personaId: "p_alice",
    rating: 1,
  };

  it("A1: returns 404 when evaluation_id does not exist", async () => {
    _supabaseMock = makeSupabase({ evaluationRow: null });
    const { POST } = await import("@/app/api/feedback/utterance/route");
    const res = await POST(makePostRequest(validRoundTableBody));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("A2: returns 403 when evaluation belongs to another user", async () => {
    _supabaseMock = makeSupabase({ projectRow: { user_id: OTHER_ID } });
    const { POST } = await import("@/app/api/feedback/utterance/route");
    const res = await POST(makePostRequest(validRoundTableBody));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/not your/i);
  });

  it("A3: returns 200 when caller owns the evaluation", async () => {
    _supabaseMock = makeSupabase({ projectRow: { user_id: CALLER_ID } });
    const { POST } = await import("@/app/api/feedback/utterance/route");
    const res = await POST(makePostRequest(validRoundTableBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.feedback).toBeDefined();
  });
});

describe("POST /api/feedback/utterance — 1v1 ownership", () => {
  const validOvOBody = {
    kind: "one_v_one",
    debateMessageId: DM_ID,
    personaId: "p_bob",
    rating: -1,
  };

  it("B1: returns 404 when debate_message_id does not exist", async () => {
    // For 1v1 we need a supabase where from("debate_messages") returns null
    // and from("debates") is never reached. We must also NOT trigger
    // getMessageIdsResult path (GET path). Override carefully.
    _supabaseMock = makeSupabase({
      dmRow: null,
      // prevent getMessageIdsResult from hijacking debate_messages calls
      getMessageIdsResult: undefined,
    });
    const { POST } = await import("@/app/api/feedback/utterance/route");
    const res = await POST(makePostRequest(validOvOBody));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("B2: returns 403 when debate_message belongs to another user's debate", async () => {
    _supabaseMock = makeSupabase({
      dmRow: { debate_id: DEBATE_ID },
      debateRow: { user_id: OTHER_ID },
      getMessageIdsResult: undefined,
    });
    const { POST } = await import("@/app/api/feedback/utterance/route");
    const res = await POST(makePostRequest(validOvOBody));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/not your/i);
  });
});

describe("GET /api/feedback/utterance — debateId error handling", () => {
  it("C1: returns 500 when debate_messages query errors", async () => {
    _supabaseMock = makeSupabase({
      getMessageIdsResult: { data: null, error: { message: "network error" } },
    });
    const { GET } = await import("@/app/api/feedback/utterance/route");
    const res = await GET(makeGetRequest({ debateId: DEBATE_ID }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});
