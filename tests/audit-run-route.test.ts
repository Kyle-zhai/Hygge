/**
 * Route handler tests for POST /api/audit/sessions/[id]/run
 *
 * Verifies the gates in front of Layers 2-5 of the multi-agent kernel:
 *   - 401 without auth
 *   - 404 when audit_sessions row missing
 *   - 409 when terminal (findings_ready/signed_off/archived)
 *   - 409 when scoping is not 'scope_locked'
 *   - 409 when scope_in is empty
 *   - 409 when status='running' AND pipeline_started_at is fresh (anti-double-enqueue)
 *   - 202 on success + reply_language defaulting (en/zh)
 *   - Stale 'running' rows are allowed to re-enqueue (cron sweeper safety net)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";

interface SessionRow {
  id: string;
  user_id: string;
  workspace_id: string | null;
  status: "pending" | "running" | "findings_ready" | "signed_off" | "archived" | "failed";
  pipeline_started_at: string | null;
}

interface ScopingRow {
  id: string;
  status: string;
  scope_in: unknown[];
}

function makeSupabase(opts: {
  userId?: string | null;
  session?: SessionRow | null;
  scoping?: ScopingRow | null;
} = {}) {
  const {
    userId = USER_ID,
    session = {
      id: SESSION_ID,
      user_id: USER_ID,
      workspace_id: null,
      status: "pending",
      pipeline_started_at: null,
    },
    scoping = {
      id: "scoping-1",
      status: "scope_locked",
      scope_in: [{ topic: "data-handling" }],
    },
  } = opts;

  const updates: Array<Record<string, unknown>> = [];

  const sessionSelectBuilder = {
    select: () => sessionSelectBuilder,
    eq: () => sessionSelectBuilder,
    maybeSingle: async () => ({ data: session, error: null }),
  };

  const sessionUpdateBuilder = {
    update: (patch: Record<string, unknown>) => {
      updates.push(patch);
      return {
        eq: () => ({
          neq: async () => ({ error: null }),
        }),
      };
    },
  };

  const scopingSelectBuilder = {
    select: () => scopingSelectBuilder,
    eq: () => scopingSelectBuilder,
    maybeSingle: async () => ({ data: scoping, error: null }),
  };

  let auditSessionsCalls = 0;

  return {
    auth: {
      getUser: async () => ({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
    from(table: string) {
      if (table === "audit_sessions") {
        auditSessionsCalls += 1;
        if (auditSessionsCalls === 1) return sessionSelectBuilder;
        return sessionUpdateBuilder;
      }
      if (table === "audit_scoping_sessions") return scopingSelectBuilder;
      throw new Error(`unexpected table: ${table}`);
    },
    _spy: { updates },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({})),
}));

vi.mock("@/lib/llm/user-overrides", () => ({
  fetchUserLLMOverrides: vi.fn(async () => null),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(async () => null),
}));

vi.mock("@/lib/queue/audit-pipeline", () => ({
  enqueueAuditPipeline: vi.fn(async () => undefined),
}));

vi.mock("@/lib/audit/hash-chain", () => ({
  appendAuditTrail: vi.fn(async () => undefined),
}));

import { createClient } from "@/lib/supabase/server";
import { enqueueAuditPipeline } from "@/lib/queue/audit-pipeline";
import { POST } from "@/app/api/audit/sessions/[id]/run/route";

function makeRequest(body: object = {}) {
  return new Request(`http://localhost/api/audit/sessions/${SESSION_ID}/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/audit/sessions/[id]/run", () => {
  it("returns 401 without auth", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabase({ userId: null }) as never,
    );
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when session not found", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabase({ session: null }) as never,
    );
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 409 when already findings_ready", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabase({
        session: {
          id: SESSION_ID,
          user_id: USER_ID,
          workspace_id: null,
          status: "findings_ready",
          pipeline_started_at: null,
        },
      }) as never,
    );
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 409 when scope is not locked", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabase({
        scoping: { id: "s", status: "questions_ready", scope_in: [] },
      }) as never,
    );
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 409 when scope_in is empty", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabase({
        scoping: { id: "s", status: "scope_locked", scope_in: [] },
      }) as never,
    );
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 409 when status='running' and pipeline_started_at is fresh", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabase({
        session: {
          id: SESSION_ID,
          user_id: USER_ID,
          workspace_id: null,
          status: "running",
          pipeline_started_at: new Date(Date.now() - 60_000).toISOString(),
        },
      }) as never,
    );
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(409);
  });

  it("re-enqueues stale 'running' rows (older than 15 min)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabase({
        session: {
          id: SESSION_ID,
          user_id: USER_ID,
          workspace_id: null,
          status: "running",
          pipeline_started_at: new Date(Date.now() - 30 * 60_000).toISOString(),
        },
      }) as never,
    );
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(202);
    expect(enqueueAuditPipeline).toHaveBeenCalledOnce();
  });

  it("returns 202 on success and defaults reply_language to 'en'", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase() as never);
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(202);
    expect(enqueueAuditPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ replyLanguage: "en" }),
    );
  });

  it("honours reply_language='zh' when provided", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase() as never);
    await POST(makeRequest({ reply_language: "zh" }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(enqueueAuditPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ replyLanguage: "zh" }),
    );
  });

  it("rejects unknown reply_language values back to 'en'", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase() as never);
    await POST(makeRequest({ reply_language: "fr" }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(enqueueAuditPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ replyLanguage: "en" }),
    );
  });
});
