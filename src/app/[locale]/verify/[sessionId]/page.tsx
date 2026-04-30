import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { decideVerdict, type TrailRow } from "@/lib/audit/hash-chain";
import type { AuditSession, AuditTemplate } from "@/lib/audit/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ sessionId: string; locale: string }>;
}

interface PublicTrailRow {
  seq: number;
  action: string;
  ts: string;
  payload_sha256: string;
  prev_hash: string | null;
  this_hash: string;
}

export default async function VerifyAuditPage({ params }: PageProps) {
  const { sessionId } = await params;
  const locale = await getLocale();
  const t = await getTranslations("audit");

  const admin = createAdminClient();

  // Project only public-safe fields. Decision text, decision_meta, payload
  // contents, signoff signatures, and actor IDs are NOT exposed.
  const sessionRes = await admin
    .from("audit_sessions")
    .select(
      "id, status, template_slug, decision_text_sha256, audit_trail_head_hash, signed_off_at, created_at, completed_at"
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (!sessionRes.data) notFound();
  const session = sessionRes.data as Pick<
    AuditSession,
    | "id"
    | "status"
    | "template_slug"
    | "decision_text_sha256"
    | "audit_trail_head_hash"
    | "signed_off_at"
    | "created_at"
    | "completed_at"
  >;

  const isPubliclyVerifiable = session.status === "signed_off";

  const [trailRes, signoffsCountRes, templateRes] = await Promise.all([
    admin
      .from("audit_trail")
      .select("seq, action, ts, payload_sha256, prev_hash, this_hash")
      .eq("session_id", sessionId)
      .order("seq"),
    admin.from("audit_signoffs").select("id", { count: "exact", head: true }).eq("session_id", sessionId),
    admin.from("audit_templates").select("name_en, name_zh").eq("slug", session.template_slug).maybeSingle(),
  ]);

  const trail = (trailRes.data ?? []) as PublicTrailRow[];
  const signoffCount = signoffsCountRes.count ?? 0;
  const template = templateRes.data as Pick<AuditTemplate, "name_en" | "name_zh"> | null;

  const verifierTrail: TrailRow[] = trail.map((r) => ({
    seq: r.seq,
    action: r.action,
    actor_id: null,
    payload_sha256: r.payload_sha256,
    prev_hash: r.prev_hash,
    this_hash: r.this_hash,
    ts: r.ts,
  }));

  const finalVerdict = decideVerdict({
    rows: verifierTrail,
    headHash: session.audit_trail_head_hash,
  });

  const templateName = template
    ? locale === "zh"
      ? template.name_zh
      : template.name_en
    : session.template_slug;

  return (
    <div className="min-h-screen bg-[color:var(--bg-primary)] text-[color:var(--text-primary)]">
      <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-[color:var(--text-tertiary)] transition-colors hover:text-[color:var(--text-primary)]"
        >
          ← {t("verifyBackToHome")}
        </Link>

        <div className="mt-6 flex items-center gap-2 text-[color:var(--text-tertiary)]">
          <ShieldCheck className="h-4 w-4 text-[color:var(--accent-warm)]" />
          <span className="text-xs uppercase tracking-wider">{t("verifyTitle")}</span>
        </div>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {templateName}
        </h1>

        <p className="mt-2 font-mono text-xs text-[color:var(--text-tertiary)]">
          {session.id}
        </p>

        {!isPubliclyVerifiable ? (
          <div className="mt-8 rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-[#F59E0B]" />
              <p className="text-sm">{t("verifyVerdictNotFound")}</p>
            </div>
          </div>
        ) : (
          <>
            <VerdictCard verdict={finalVerdict} t={t} />

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Field label={t("verifyTemplate")} value={templateName} />
              <Field
                label={t("verifyTrailLength")}
                value={String(trail.length)}
                mono
              />
              <Field
                label={t("verifyCreatedAt")}
                value={new Date(session.created_at).toUTCString()}
                mono
              />
              <Field
                label={t("verifySignedOffAt")}
                value={
                  session.signed_off_at
                    ? new Date(session.signed_off_at).toUTCString()
                    : "—"
                }
                mono
              />
              <Field
                label={t("verifySignoffCount")}
                value={String(signoffCount)}
                mono
              />
              <Field
                label={t("verifyDecisionTextSha256")}
                value={session.decision_text_sha256}
                mono
                fullSpan
              />
              <Field
                label={t("verifyHeadHash")}
                value={session.audit_trail_head_hash ?? "—"}
                mono
                fullSpan
              />
            </div>

            <section className="mt-10 rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--text-tertiary)]">
                {t("verifyHowToVerify")}
              </h2>
              <p className="mt-3 text-sm leading-relaxed">
                {t("verifyHowToVerifyBody")}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-[color:var(--text-tertiary)]">
                {t("verifyExplainer")}
              </p>
            </section>

            <section className="mt-10">
              <h2 className="mb-3 text-lg font-semibold">{t("verifyChainTitle")}</h2>
              <div className="overflow-x-auto rounded-lg border border-[color:var(--border-default)]">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="bg-[color:var(--bg-secondary)] text-[color:var(--text-tertiary)]">
                      <th className="px-3 py-2 text-left">{t("verifyChainColumnSeq")}</th>
                      <th className="px-3 py-2 text-left">{t("verifyChainColumnAction")}</th>
                      <th className="px-3 py-2 text-left">{t("verifyChainColumnTs")}</th>
                      <th className="px-3 py-2 text-left">{t("verifyChainColumnPayloadSha")}</th>
                      <th className="px-3 py-2 text-left">{t("verifyChainColumnThisHash")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trail.map((row) => (
                      <tr
                        key={row.seq}
                        className="border-t border-[color:var(--border-default)]"
                      >
                        <td className="px-3 py-2">{row.seq}</td>
                        <td className="px-3 py-2">{row.action}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {new Date(row.ts).toUTCString()}
                        </td>
                        <td className="px-3 py-2 break-all">
                          {row.payload_sha256.slice(0, 16)}…
                        </td>
                        <td className="px-3 py-2 break-all">
                          {row.this_hash.slice(0, 16)}…
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  fullSpan,
}: {
  label: string;
  value: string;
  mono?: boolean;
  fullSpan?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-3 ${
        fullSpan ? "sm:col-span-2" : ""
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--text-tertiary)]">
        {label}
      </div>
      <div
        className={`mt-1 text-sm ${
          mono ? "font-mono break-all text-xs" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function VerdictCard({
  verdict,
  t,
}: {
  verdict: "pass" | "fail";
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  if (verdict === "pass") {
    return (
      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#34D39955] bg-[#10B98115] p-5">
        <CheckCircle2 className="h-6 w-6 text-[#10B981]" />
        <p className="text-sm font-medium">{t("verifyVerdictPass")}</p>
      </div>
    );
  }
  return (
    <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#F8717155] bg-[#F8717115] p-5">
      <AlertTriangle className="h-6 w-6 text-[#F87171]" />
      <p className="text-sm font-medium">{t("verifyVerdictFail")}</p>
    </div>
  );
}
