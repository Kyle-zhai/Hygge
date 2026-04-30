import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { appendAuditTrail } from "@/lib/audit/hash-chain";

export const maxDuration = 10;

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { signature?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const signature = body.signature?.trim();
  const role = body.role?.trim();
  if (!signature || !role) {
    return NextResponse.json({ error: "signature and role are required" }, { status: 400 });
  }
  if (signature.length > 200 || role.length > 100) {
    return NextResponse.json({ error: "signature/role too long" }, { status: 400 });
  }

  const { data: session } = await supabase
    .from("audit_sessions")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (session.status === "signed_off" || session.status === "archived") {
    return NextResponse.json({ error: "Already signed off" }, { status: 409 });
  }
  if (session.status !== "findings_ready") {
    return NextResponse.json(
      { error: "Audit findings are not ready for signoff yet" },
      { status: 409 }
    );
  }

  const { count: openFindings } = await supabase
    .from("audit_findings")
    .select("id", { count: "exact", head: true })
    .eq("session_id", id)
    .is("user_disposition", null)
    .not("finding_kind", "in", "(no_risk,mitigation)");

  if ((openFindings ?? 0) > 0) {
    return NextResponse.json(
      { error: `${openFindings} findings still need a disposition` },
      { status: 409 }
    );
  }

  const ipHeader = request.headers.get("x-forwarded-for") ?? "";
  const ip = ipHeader.split(",")[0]?.trim() ?? "";
  const ipHash = ip ? createHash("sha256").update(ip).digest("hex") : null;

  const { error: signoffErr } = await supabase
    .from("audit_signoffs")
    .insert({
      session_id: id,
      actor_id: user.id,
      role,
      signature,
      ip_hash: ipHash,
    });

  if (signoffErr) {
    if (signoffErr.code === "23505") {
      return NextResponse.json({ error: "Already signed off in this role" }, { status: 409 });
    }
    return NextResponse.json({ error: signoffErr.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error: sessionErr } = await supabase
    .from("audit_sessions")
    .update({
      status: "signed_off",
      signed_off_by: user.id,
      signed_off_at: now,
      signed_off_signature: signature,
      completed_at: now,
    })
    .eq("id", id);

  if (sessionErr) {
    return NextResponse.json({ error: sessionErr.message }, { status: 500 });
  }

  try {
    await appendAuditTrail(supabase, {
      sessionId: id,
      action: "signed_off",
      actorId: user.id,
      payload: { role, signature_sha256: createHash("sha256").update(signature).digest("hex") },
    });
  } catch (trailErr) {
    console.error("audit_trail append failed on signoff:", trailErr);
  }

  return NextResponse.json({ ok: true });
}
