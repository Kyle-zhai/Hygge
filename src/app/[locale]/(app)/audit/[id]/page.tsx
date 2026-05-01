import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight, ScanSearch, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AuditSessionView } from "@/components/audit/audit-session-view";
import { AuditScopingEntry } from "@/components/audit/audit-scoping-entry";
import { AuditPipelineRunner } from "@/components/audit/audit-pipeline-runner";
import type { AuditFinding, AuditSession, AuditSignoff, AuditTemplate } from "@/lib/audit/types";

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default async function AuditDetailPage({ params }: PageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const t = await getTranslations("audit");

  const [sessionRes, findingsRes, signoffsRes, scopingRes] = await Promise.all([
    supabase.from("audit_sessions").select("*").eq("id", id).maybeSingle(),
    supabase.from("audit_findings").select("*").eq("session_id", id).order("display_order"),
    supabase.from("audit_signoffs").select("*").eq("session_id", id).order("created_at"),
    supabase
      .from("audit_scoping_sessions")
      .select("id, status, scope_in, scope_out, scope_locked_at")
      .eq("audit_session_id", id)
      .maybeSingle(),
  ]);

  if (!sessionRes.data) notFound();

  const session = sessionRes.data as AuditSession;
  if (session.user_id !== user.id) notFound();
  const findings = (findingsRes.data ?? []) as AuditFinding[];
  const signoffs = (signoffsRes.data ?? []) as AuditSignoff[];
  const scoping = (scopingRes.data ?? null) as {
    id: string;
    status: "created" | "annotating" | "scoping" | "awaiting_user" | "scope_locked" | "failed";
    scope_in: Array<{ law_id: string }>;
    scope_out: Array<{ law_id: string }>;
    scope_locked_at: string | null;
  } | null;

  const { data: templateRow } = await supabase
    .from("audit_templates")
    .select("slug, name_en, name_zh, description_en, description_zh, regulation_refs, default_persona_ids, system_prompt_overlay, output_schema, display_order, is_active")
    .eq("slug", session.template_slug)
    .maybeSingle();

  const template = (templateRow ?? null) as AuditTemplate | null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <Link
        href={`/${locale}/audit`}
        className="inline-flex items-center gap-1 text-sm text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] mb-6 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("indexTitle")}
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 text-[color:var(--text-tertiary)]">
          <ShieldCheck className="h-4 w-4 text-[color:var(--accent-warm)]" />
          <span className="text-xs uppercase tracking-wider">
            {template ? (locale === "zh" ? template.name_zh : template.name_en) : session.template_slug}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-3 text-[color:var(--text-primary)]">
          {firstLine(session.decision_text)}
        </h1>
        {template?.regulation_refs && template.regulation_refs[0] !== "(general)" && (
          <div className="flex flex-wrap gap-1.5">
            {template.regulation_refs.map((ref) => (
              <span
                key={ref}
                className="text-[11px] rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-2 py-0.5 text-[color:var(--text-tertiary)]"
              >
                {ref}
              </span>
            ))}
          </div>
        )}
      </div>

      {renderScopingBanner(scoping, id, locale, t, session)}

      <AuditSessionView
        session={session}
        findings={findings}
        signoffs={signoffs}
        locale={locale}
        currentUserId={user.id}
      />
    </div>
  );
}

function renderScopingBanner(
  scoping: {
    id: string;
    status: "created" | "annotating" | "scoping" | "awaiting_user" | "scope_locked" | "failed";
    scope_in: Array<{ law_id: string }>;
    scope_out: Array<{ law_id: string }>;
  } | null,
  auditSessionId: string,
  locale: string,
  t: Awaited<ReturnType<typeof getTranslations<"audit">>>,
  session: AuditSession,
) {
  if (!scoping) {
    return (
      <div className="mb-6">
        <AuditScopingEntry
          auditSessionId={auditSessionId}
          locale={locale}
          startLabel={t("scopingEntryStart")}
          hintLabel={t("scopingEntryHint")}
          betaLabel={t("scopingEntryBeta")}
        />
      </div>
    );
  }

  if (scoping.status === "scope_locked") {
    const decisionMeta = (session.decision_meta ?? {}) as Record<string, unknown>;
    const replyLanguage: "en" | "zh" =
      decisionMeta.reply_language === "zh" ? "zh" : "en";
    const pipelineError =
      typeof decisionMeta.pipeline_error === "string"
        ? decisionMeta.pipeline_error
        : null;
    return (
      <div className="mb-6 space-y-3">
        <AuditPipelineRunner
          auditSessionId={auditSessionId}
          locale={locale}
          replyLanguage={replyLanguage}
          initialStatus={session.status}
          initialPipelineError={pipelineError}
          labels={{
            runningTitle: t("pipelineBannerRunningTitle"),
            runningSubtitle: t("pipelineBannerRunningSubtitle"),
            readyTitle: t("pipelineBannerReadyTitle"),
            readySubtitle: t("pipelineBannerReadySubtitle"),
            readyView: t("pipelineBannerReadyView"),
            failedTitle: t("pipelineBannerFailedTitle"),
            failedRetry: t("pipelineBannerFailedRetry"),
            startError: t("pipelineBannerStartError"),
          }}
        />
        <div className="flex items-center gap-2 text-xs text-[color:var(--text-tertiary)]">
          <ScanSearch className="h-3.5 w-3.5 text-[color:var(--accent-warm)]" />
          <span>
            {t("scopingBannerLockedSubtitle", {
              inCount: scoping.scope_in.length,
              outCount: scoping.scope_out.length,
            })}
          </span>
          <Link
            href={`/${locale}/audit/${auditSessionId}/scope`}
            className="inline-flex items-center gap-1 hover:text-[color:var(--accent-warm)] transition-colors"
          >
            {t("scopingBannerLockedView")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  if (scoping.status === "failed") {
    return (
      <div className="mb-6 rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 px-4 py-3 flex items-center gap-3">
        <ScanSearch className="h-4 w-4 text-[#F87171] shrink-0" />
        <div className="flex-1 text-xs text-[#F87171]">
          {t("scopingBannerFailed")}
        </div>
        <Link
          href={`/${locale}/audit/${auditSessionId}/scope`}
          className="inline-flex items-center gap-1 text-xs text-[#F87171] hover:text-[#F87171]/80 transition-colors"
        >
          {t("scopingBannerFailedView")}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-[color:var(--accent-warm)]/40 bg-[rgb(var(--accent-warm-rgb)/0.08)] px-4 py-3 flex items-center gap-3">
      <ScanSearch className="h-4 w-4 text-[color:var(--accent-warm)] shrink-0 animate-pulse" />
      <div className="flex-1 text-xs text-[color:var(--text-tertiary)]">
        <span className="text-[color:var(--text-primary)] font-medium">
          {t("scopingBannerInProgressTitle")}
        </span>{" "}
        {t("scopingBannerInProgressSubtitle")}
      </div>
      <Link
        href={`/${locale}/audit/${auditSessionId}/scope`}
        className="inline-flex items-center gap-1 text-xs text-[color:var(--text-primary)] hover:text-[color:var(--accent-warm)] transition-colors"
      >
        {t("scopingBannerInProgressContinue")}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function firstLine(text: string): string {
  const line = text.split("\n")[0]?.trim() ?? "—";
  return line.length > 120 ? line.slice(0, 120) + "…" : line;
}
