import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ShieldCheck, ArrowRight, Plus, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { AuditSession, AuditSessionStatus, AuditTemplate } from "@/lib/audit/types";
import { AuditListRow } from "@/components/audit/audit-list-row";

type AuditSessionRow = Pick<
  AuditSession,
  "id" | "template_slug" | "decision_text" | "status" | "created_at" | "completed_at"
>;

const STATUS_ICON: Record<AuditSessionStatus, typeof Loader2> = {
  pending: Clock,
  running: Loader2,
  findings_ready: AlertCircle,
  signed_off: CheckCircle2,
  archived: CheckCircle2,
  failed: AlertCircle,
};

function decisionPreview(text: string): string {
  const firstLine = text.split("\n")[0]?.trim() ?? "";
  if (!firstLine) return "—";
  return firstLine.length > 80 ? firstLine.slice(0, 80) + "…" : firstLine;
}

function formatRelative(iso: string, locale: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  const zh = locale === "zh";
  if (min < 1) return zh ? "刚刚" : "just now";
  if (min < 60) return zh ? `${min} 分钟前` : `${min}m ago`;
  if (hour < 24) return zh ? `${hour} 小时前` : `${hour}h ago`;
  if (day < 7) return zh ? `${day} 天前` : `${day}d ago`;
  return d.toLocaleDateString(zh ? "zh-CN" : "en-US", { month: "short", day: "numeric" });
}

export default async function AuditIndexPage() {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const t = await getTranslations("audit");

  const [sessionsRes, templatesRes] = await Promise.all([
    supabase
      .from("audit_sessions")
      .select("id, template_slug, decision_text, status, created_at, completed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("audit_templates")
      .select("slug, name_en, name_zh")
      .eq("is_active", true),
  ]);

  const sessions = (sessionsRes.data ?? []) as AuditSessionRow[];
  const templates = (templatesRes.data ?? []) as Array<Pick<AuditTemplate, "slug" | "name_en" | "name_zh">>;
  const templateMap = new Map(templates.map((tpl) => [tpl.slug, tpl]));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2 text-[color:var(--text-tertiary)]">
            <ShieldCheck className="h-4 w-4 text-[color:var(--accent-warm)]" />
            <span className="text-xs uppercase tracking-wider">{t("navLabel")}</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--text-primary)]">{t("indexTitle")}</h1>
        </div>
        <Link
          href={`/${locale}/audit/new`}
          className="inline-flex items-center gap-2 rounded-full bg-[color:var(--text-primary)] px-5 py-2 text-sm font-medium text-[color:var(--bg-primary)] transition-transform hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" />
          {t("indexNewButton")}
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-10 text-center">
          <p className="text-[color:var(--text-tertiary)] mb-4">{t("indexEmpty")}</p>
          <Link
            href={`/${locale}/audit/new`}
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--text-primary)] px-5 py-2 text-sm font-medium text-[color:var(--bg-primary)] transition-transform hover:-translate-y-0.5"
          >
            {t("newCta")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--border-default)] rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)]">
          {sessions.map((session) => {
            const Icon = STATUS_ICON[session.status];
            const tpl = templateMap.get(session.template_slug);
            const tplName = tpl ? (locale === "zh" ? tpl.name_zh : tpl.name_en) : session.template_slug;
            const iconClassName = `h-5 w-5 shrink-0 ${
              session.status === "running" ? "animate-spin" : ""
            } ${
              session.status === "failed"
                ? "text-[#F87171]"
                : session.status === "signed_off"
                ? "text-emerald-600"
                : "text-[color:var(--text-tertiary)]"
            }`;
            return (
              <AuditListRow
                key={session.id}
                sessionId={session.id}
                href={`/${locale}/audit/${session.id}`}
                status={session.status}
                icon={<Icon className={iconClassName} />}
                preview={decisionPreview(session.decision_text)}
                meta={
                  <>
                    <span>{tplName}</span>
                    <span>·</span>
                    <span>{t(`sessionStatus${statusKey(session.status)}`)}</span>
                    <span>·</span>
                    <span>{formatRelative(session.created_at, locale)}</span>
                  </>
                }
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

function statusKey(status: AuditSessionStatus): string {
  return ({
    pending: "Pending",
    running: "Running",
    findings_ready: "FindingsReady",
    signed_off: "SignedOff",
    archived: "Archived",
    failed: "Failed",
  } as const)[status];
}
