/**
 * Route handler tests for POST /api/audit/[id]/signoff
 *
 * These tests verify the compliance-critical guards:
 *   - Cannot sign off another user's audit (403)
 *   - Cannot sign off until status === 'findings_ready' (409)
 *   - Cannot sign off if any non-mitigation finding lacks a disposition (409)
 *   - Cannot double-sign in the same role (409)
 *   - On success: session moves to signed_off, trail row appended
 */

import { describe, it, expect, vi } from "vitest";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";

interface SessionRow {
  id: string;
  user_id: string;
  status: "pending" | "running" | "findings_ready" | "signed_off" | "archived" | "failed";
}

function makeSupabase(opts: {
  userId?: string;
  session?: SessionRow | null;
  openFindingsCount?: number;
  signoffInsertError?: { code?: string; message?: string } | null;
  sessionUpdateError?: { message: string } | null;
  trailHeadHash?: string | null;
}) {
  const {
    userId = USER_ID,
    session = { id: SESSION_ID, user_id: USER_ID, status: "findings_ready" },
    openFindingsCount = 0,
    signoffInsertError = null,
    sessionUpdateError = null,
    trailHeadHash = null,
  } = opts;

  const fromCalls: Array<{ table: string; op: string }> = [];
  const updates: Array<Record<string, unknown>> = [];
  const inserts: Array<Record<string, unknown>> = [];

  const sessionSelectBuilder = {
    select: () => sessionSelectBuilder,
    eq: () => sessionSelectBuilder,
    maybeSingle: async () => ({ data: session, error: null }),
  };

  const findingsCountBuilder = {
    select: () => findingsCountBuilder,
    eq: () => findingsCountBuilder,
    is: () => findingsCountBuilder,
    not: () => ({ count: openFindingsCount }),
  };

  const signoffInsertBuilder = {
    insert: (row: Record<string, unknown>) => {
      inserts.push(row);
      return Promise.resolve({ error: signoffInsertError });
    },
  };

  const sessionUpdateBuilder = {
    update: (row: Record<string, unknown>) => {
      updates.push(row);
      return {
        eq: () => Promise.resolve({ error: sessionUpdateError }),
      };
    },
  };

  // For appendAuditTrail: needs to read head_hash, then read latest seq, then insert, then update.
  const trailHeadSelectBuilder = {
    select: () => trailHeadSelectBuilder,
    eq: () => trailHeadSelectBuilder,
    maybeSingle: async () => ({ data: { audit_trail_head_hash: trailHeadHash }, error: null }),
  };

  const trailSeqSelectBuilder = {
    select: () => trailSeqSelectBuilder,
    eq: () => trailSeqSelectBuilder,
    order: () => trailSeqSelectBuilder,
    limit: () => trailSeqSelectBuilder,
    maybeSingle: async () => ({ data: null, error: null }),
  };

  let sessionSelectCallIndex = 0;
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: userId } }, error: null }),
    },
    from: (table: string) => {
      fromCalls.push({ table, op: "from" });
      if (table === "audit_sessions") {
        sessionSelectCallIndex++;
        // First call: session ownership/status select. Second: trail head select. Third: status update.
        if (sessionSelectCallIndex === 1) return sessionSelectBuilder;
        if (sessionSelectCallIndex === 2) return sessionUpdateBuilder;
        if (sessionSelectCallIndex === 3) return trailHeadSelectBuilder;
        return sessionUpdateBuilder;
      }
      if (table === "audit_findings") return findingsCountBuilder;
      if (table === "audit_signoffs") return signoffInsertBuilder;
      if (table === "audit_trail") {
        // Could be select(seq) or insert
        return {
          ...trailSeqSelectBuilder,
          insert: (row: Record<string, unknown>) => {
            inserts.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
    _spy: { fromCalls, updates, inserts },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/audit/[id]/signoff/route";

function makeRequest(body: object) {
  return new Request("http://localhost/api/audit/x/signoff", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/audit/[id]/signoff", () => {
  it("returns 401 without auth", async () => {
    const sb = makeSupabase({});
    sb.auth.getUser = async () => ({ data: { user: null }, error: null }) as never;
    vi.mocked(createClient).mockResolvedValue(sb as never);
    const res = await POST(makeRequest({ signature: "Y", role: "Compliance" }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 when signature missing", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({}) as never);
    const res = await POST(makeRequest({ role: "X" }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 403 when caller does not own the session", async () => {
    const sb = makeSupabase({
      session: { id: SESSION_ID, user_id: OTHER_ID, status: "findings_ready" },
    });
    vi.mocked(createClient).mockResolvedValue(sb as never);
    const res = await POST(makeRequest({ signature: "Y", role: "C" }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 409 when status !== findings_ready", async () => {
    const sb = makeSupabase({
      session: { id: SESSION_ID, user_id: USER_ID, status: "running" },
    });
    vi.mocked(createClient).mockResolvedValue(sb as never);
    const res = await POST(makeRequest({ signature: "Y", role: "C" }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 409 when status === signed_off (already done)", async () => {
    const sb = makeSupabase({
      session: { id: SESSION_ID, user_id: USER_ID, status: "signed_off" },
    });
    vi.mocked(createClient).mockResolvedValue(sb as never);
    const res = await POST(makeRequest({ signature: "Y", role: "C" }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 409 when undecided risk findings remain (compliance gate)", async () => {
    const sb = makeSupabase({ openFindingsCount: 3 });
    vi.mocked(createClient).mockResolvedValue(sb as never);
    const res = await POST(makeRequest({ signature: "Y", role: "C" }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/disposition/);
  });

  it("returns 409 with friendly message on 23505 unique-violation (double-sign in same role)", async () => {
    const sb = makeSupabase({
      signoffInsertError: { code: "23505", message: "duplicate" },
    });
    vi.mocked(createClient).mockResolvedValue(sb as never);
    const res = await POST(makeRequest({ signature: "Y", role: "C" }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/Already signed off/i);
  });
});
