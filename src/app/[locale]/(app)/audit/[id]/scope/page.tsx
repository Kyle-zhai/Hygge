import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, ScanSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AuditScopingChat } from "@/components/audit/audit-scoping-chat";

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

interface ScopingRow {
  id: string;
  audit_session_id: string;
  status: "created" | "annotating" | "scoping" | "awaiting_user" | "scope_locked" | "failed";
  passages: Array<{ idx: number; text: string; annotations: string[] }>;
  cursor: number;
  conversation: Array<{
    role: "system" | "user";
    kind: "question" | "answer" | "scope_update" | "note";
    text: string;
    ts?: string;
    refs?: { passage_idx?: number; law_id?: string; question_id?: string };
  }>;
  pending_question: {
    id: string;
    text: string;
    context: string;
    answer_format: "yes_no" | "single_select" | "free_text";
    options: string[] | null;
    asked_at_passage_idx: number;
  } | null;
  scope_in: Array<{ law_id: string; status: "in" | "out"; reason: string; passage_refs: number[] }>;
  scope_out: Array<{ law_id: string; status: "in" | "out"; reason: string; passage_refs: number[] }>;
  question_count: number;
  max_questions: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  scope_locked_at: string | null;
}

export default async function AuditScopingPage({ params }: PageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const t = await getTranslations("audit");

  const { data: session } = await supabase
    .from("audit_sessions")
    .select("id, user_id, decision_text")
    .eq("id", id)
    .maybeSingle();
  if (!session) notFound();
  if (session.user_id !== user.id) notFound();

  const { data: scopingRow } = await supabase
    .from("audit_scoping_sessions")
    .select(
      "id, audit_session_id, status, passages, cursor, conversation, pending_question, scope_in, scope_out, question_count, max_questions, error_message, created_at, updated_at, scope_locked_at",
    )
    .eq("audit_session_id", id)
    .maybeSingle();
  if (!scopingRow) notFound();

  const initial = scopingRow as unknown as ScopingRow;

  const referencedLawIds = Array.from(
    new Set([
      ...initial.scope_in.map((s) => s.law_id),
      ...initial.scope_out.map((s) => s.law_id),
    ]),
  );

  const { data: lawRows } = referencedLawIds.length
    ? await supabase
        .from("audit_law_catalog")
        .select("id, name_en, name_zh, jurisdiction")
        .in("id", referencedLawIds)
    : { data: [] as Array<{ id: string; name_en: string; name_zh: string; jurisdiction: string }> };

  const lawCatalog = (lawRows ?? []) as Array<{
    id: string;
    name_en: string;
    name_zh: string;
    jurisdiction: string;
  }>;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <Link
        href={`/${locale}/audit/${id}`}
        className="inline-flex items-center gap-1 text-sm text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] mb-6 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("scopingBackToAudit")}
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 text-[color:var(--text-tertiary)]">
          <ScanSearch className="h-4 w-4 text-[color:var(--accent-warm)]" />
          <span className="text-xs uppercase tracking-wider">{t("scopingTitle")}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2 text-[color:var(--text-primary)]">
          {firstLine(session.decision_text)}
        </h1>
        <p className="text-sm text-[color:var(--text-tertiary)] leading-relaxed">
          {t("scopingSubtitle")}
        </p>
      </div>

      <AuditScopingChat
        scopingId={initial.id}
        auditSessionId={initial.audit_session_id}
        initial={initial}
        lawCatalog={lawCatalog}
        locale={locale}
      />
    </div>
  );
}

function firstLine(text: string): string {
  const line = text.split("\n")[0]?.trim() ?? "—";
  return line.length > 120 ? line.slice(0, 120) + "…" : line;
}
