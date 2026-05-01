import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendAuditTrail } from "@/lib/audit/hash-chain";

export const maxDuration = 10;

interface Ctx {
  params: Promise<{ id: string }>;
}

interface FinalizeBody {
  force?: boolean;
}

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: FinalizeBody = {};
  try {
    body = (await request.json().catch(() => ({}))) as FinalizeBody;
  } catch {
    body = {};
  }

  const { data, error } = await supabase.rpc("finalize_scoping_session", {
    p_scoping_id: id,
    p_force: !!body.force,
  });
  if (error) {
    const msg = error.message || "finalize_scoping_session failed";
    const status = /pending question|not found/.test(msg) ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  // Best-effort audit trail entry on the parent session, if we can resolve it.
  const auditSessionId = (data as { audit_session_id?: string } | null)?.audit_session_id;
  if (auditSessionId) {
    try {
      await appendAuditTrail(createAdminClient(), {
        sessionId: auditSessionId,
        action: "scope_locked",
        actorId: user.id,
        payload: { scoping_id: id, forced: !!body.force },
      });
    } catch (trailErr) {
      console.error("audit_trail append failed on scope_locked:", trailErr);
    }
  }

  return NextResponse.json({ ok: true, scoping: data });
}
