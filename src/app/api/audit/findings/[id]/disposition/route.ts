import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appendAuditTrail } from "@/lib/audit/hash-chain";

export const maxDuration = 10;

const VALID_DISPOSITIONS = new Set([
  "accept_mitigation",
  "accept_residual",
  "reject",
  "defer",
]);

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { disposition?: string; note?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { disposition, note } = body;
  if (!disposition || !VALID_DISPOSITIONS.has(disposition)) {
    return NextResponse.json({ error: "Invalid disposition" }, { status: 400 });
  }

  const { data: finding, error: findErr } = await supabase
    .from("audit_findings")
    .select("id, session_id")
    .eq("id", id)
    .maybeSingle();
  if (findErr || !finding) {
    return NextResponse.json({ error: "Finding not found" }, { status: 404 });
  }

  const { data: session } = await supabase
    .from("audit_sessions")
    .select("id, user_id, status")
    .eq("id", finding.session_id)
    .maybeSingle();
  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (session.status === "signed_off" || session.status === "archived" || session.status === "failed") {
    return NextResponse.json({ error: "Audit is locked" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("audit_findings")
    .update({
      user_disposition: disposition,
      user_disposition_note: note ?? null,
      user_disposition_at: now,
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  try {
    await appendAuditTrail(supabase, {
      sessionId: session.id,
      action: "disposition_set",
      actorId: user.id,
      payload: { finding_id: id, disposition, note: note ?? null },
    });
  } catch (trailErr) {
    console.error("audit_trail append failed:", trailErr);
  }

  return NextResponse.json({ ok: true });
}
