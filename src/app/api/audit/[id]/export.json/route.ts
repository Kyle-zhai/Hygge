import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyChain } from "@/lib/audit/hash-chain";
import type {
  AuditFinding,
  AuditSession,
  AuditSignoff,
  AuditTrailEntry,
} from "@/lib/audit/types";

export const maxDuration = 10;

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [sessionRes, findingsRes, signoffsRes, trailRes] = await Promise.all([
    supabase.from("audit_sessions").select("*").eq("id", id).maybeSingle(),
    supabase.from("audit_findings").select("*").eq("session_id", id).order("display_order"),
    supabase.from("audit_signoffs").select("*").eq("session_id", id).order("created_at"),
    supabase.from("audit_trail").select("*").eq("session_id", id).order("seq"),
  ]);

  if (!sessionRes.data) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const session = sessionRes.data as AuditSession;
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const findings = (findingsRes.data ?? []) as AuditFinding[];
  const signoffs = (signoffsRes.data ?? []) as AuditSignoff[];
  const trail = (trailRes.data ?? []) as AuditTrailEntry[];

  const firstInvalidIndex = verifyChain(trail);
  const chainValid = firstInvalidIndex === null;

  const payload = {
    schema_version: "1.0",
    exported_at: new Date().toISOString(),
    session,
    findings,
    signoffs,
    audit_trail: trail,
    verification: {
      chain_valid: chainValid,
      first_invalid_index: firstInvalidIndex,
      head_hash: session.audit_trail_head_hash,
      trail_length: trail.length,
    },
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="audit-${session.id}.json"`,
    },
  });
}
