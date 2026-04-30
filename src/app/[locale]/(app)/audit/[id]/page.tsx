import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AuditSessionView } from "@/components/audit/audit-session-view";
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

  const [sessionRes, findingsRes, signoffsRes] = await Promise.all([
    supabase.from("audit_sessions").select("*").eq("id", id).maybeSingle(),
    supabase.from("audit_findings").select("*").eq("session_id", id).order("display_order"),
    supabase.from("audit_signoffs").select("*").eq("session_id", id).order("created_at"),
  ]);

  if (!sessionRes.data) notFound();

  const session = sessionRes.data as AuditSession;
  if (session.user_id !== user.id) notFound();
  const findings = (findingsRes.data ?? []) as AuditFinding[];
  const signoffs = (signoffsRes.data ?? []) as AuditSignoff[];

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
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("indexTitle")}
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wider">
            {template ? (locale === "zh" ? template.name_zh : template.name_en) : session.template_slug}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-3">
          {firstLine(session.decision_text)}
        </h1>
        {template?.regulation_refs && template.regulation_refs[0] !== "(general)" && (
          <div className="flex flex-wrap gap-1.5">
            {template.regulation_refs.map((ref) => (
              <span
                key={ref}
                className="text-[11px] rounded border border-border bg-background/40 px-1.5 py-0.5 text-muted-foreground"
              >
                {ref}
              </span>
            ))}
          </div>
        )}
      </div>

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

function firstLine(text: string): string {
  const line = text.split("\n")[0]?.trim() ?? "—";
  return line.length > 120 ? line.slice(0, 120) + "…" : line;
}
