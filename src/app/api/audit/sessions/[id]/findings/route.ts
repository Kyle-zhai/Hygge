// /api/audit/sessions/[id]/findings — GET
//
// Returns the audit's current findings + synthesized report snapshot. Used by
// the report UI to render the multi-agent kernel output. RLS already gates
// visibility (owner OR workspace member).
//
// Response shape:
//   {
//     status: "pending" | "running" | "findings_ready" | "signed_off" | "archived" | "failed",
//     reply_language: "en" | "zh",
//     synthesized_report: SynthesizedReport | null,
//     findings: AuditFindingRow[],
//     pipeline_error: string | null
//   }

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 10;

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: Ctx) {
  const { id: sessionId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: session, error: sessionErr } = await supabase
    .from("audit_sessions")
    .select("id, status, decision_meta, completed_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionErr || !session) {
    return NextResponse.json(
      { error: "Audit session not found" },
      { status: 404 },
    );
  }

  const { data: findings, error: findingsErr } = await supabase
    .from("audit_findings")
    .select(
      "id, session_id, persona_id, pool_persona_id, finding_kind, severity, probability, claim, suggested_mitigation, confidence, basis, citations, law_id, law_section, task_id, dissent, search_cache_ids, user_disposition, user_disposition_note, user_disposition_at, display_order, created_at",
    )
    .eq("session_id", sessionId)
    .order("display_order", { ascending: true });
  if (findingsErr) {
    return NextResponse.json(
      { error: findingsErr.message },
      { status: 500 },
    );
  }

  const meta = (session.decision_meta ?? {}) as Record<string, unknown>;
  const replyLanguage =
    typeof meta.reply_language === "string" &&
    (meta.reply_language === "en" || meta.reply_language === "zh")
      ? meta.reply_language
      : "en";

  return NextResponse.json({
    status: session.status,
    reply_language: replyLanguage,
    synthesized_report: meta.synthesized_report ?? null,
    findings: findings ?? [],
    pipeline_error:
      typeof meta.pipeline_error === "string" ? meta.pipeline_error : null,
    completed_at: session.completed_at ?? null,
  });
}
