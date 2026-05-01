import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReportPrintTrigger } from "@/components/audit/report-print-trigger";
import type {
  AuditFinding,
  AuditFindingKind,
  AuditSession,
  AuditSignoff,
  AuditTemplate,
  AuditTrailEntry,
} from "@/lib/audit/types";

// Synthesized-report shape shared with worker/src/audit/synthesizer.ts. Kept
// here as a local mirror so the page doesn't reach across the worker package
// boundary; if either drifts we'll catch it via the report-page tests.
type FindingConfidence = "settled" | "unsettled" | "speculative";
type FindingBasis =
  | "statute"
  | "regulation"
  | "agency_guidance"
  | "case_law"
  | "secondary_source";
type OverallCompliance = "compliant" | "partial" | "non_compliant" | "unknown";
interface SynthCitation {
  url: string;
  title: string;
  quote: string;
  published_at: string | null;
}
interface SynthLawFinding {
  section: string;
  claim: string;
  confidence: FindingConfidence;
  basis: FindingBasis;
  stale: boolean;
  citations: SynthCitation[];
  dissent: string | null;
  severity: number | null;
  probability: number | null;
  suggested_mitigation: string | null;
}
interface SynthLaw {
  law_id: string;
  overall_compliance: OverallCompliance;
  findings: SynthLawFinding[];
}
interface SynthOutOfScope {
  law_id: string;
  reason: string;
}
interface SynthesizedReport {
  executive_summary: string;
  in_scope_analysis: SynthLaw[];
  out_of_scope: SynthOutOfScope[];
  open_questions: string[];
  disclaimer: string;
}

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default async function AuditReportPage({ params }: PageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const t = await getTranslations("audit");

  const [sessionRes, findingsRes, signoffsRes, trailRes] = await Promise.all([
    supabase.from("audit_sessions").select("*").eq("id", id).maybeSingle(),
    supabase.from("audit_findings").select("*").eq("session_id", id).order("display_order"),
    supabase.from("audit_signoffs").select("*").eq("session_id", id).order("created_at"),
    supabase.from("audit_trail").select("*").eq("session_id", id).order("seq"),
  ]);

  if (!sessionRes.data) notFound();

  const session = sessionRes.data as AuditSession;
  if (session.user_id !== user.id) notFound();
  const findings = (findingsRes.data ?? []) as AuditFinding[];
  const signoffs = (signoffsRes.data ?? []) as AuditSignoff[];
  const trail = (trailRes.data ?? []) as AuditTrailEntry[];

  const { data: templateRow } = await supabase
    .from("audit_templates")
    .select("*")
    .eq("slug", session.template_slug)
    .maybeSingle();
  const template = templateRow as AuditTemplate | null;

  const personaIds = Array.from(new Set(findings.map((f) => f.persona_id)));
  const { data: personaRows } = personaIds.length
    ? await supabase
        .from("personas")
        .select("id, identity")
        .in("id", personaIds)
    : { data: [] };
  const personaMap = new Map(
    (personaRows ?? []).map((row: { id: string; identity: { name: string; locale_variants?: Record<string, { name: string }> } }) => [
      row.id,
      row.identity?.locale_variants?.[locale]?.name ?? row.identity?.name ?? row.id,
    ])
  );

  const findingsByKind = new Map<AuditFindingKind, AuditFinding[]>();
  for (const f of findings) {
    const arr = findingsByKind.get(f.finding_kind) ?? [];
    arr.push(f);
    findingsByKind.set(f.finding_kind, arr);
  }

  const decisionMeta = (session.decision_meta ?? {}) as Record<string, unknown>;
  const synthesizedReport = isSynthesizedReport(
    decisionMeta.synthesized_report,
  )
    ? (decisionMeta.synthesized_report as SynthesizedReport)
    : null;

  const lawNameById = new Map<string, string>();
  if (synthesizedReport) {
    const lawIds = new Set<string>();
    for (const law of synthesizedReport.in_scope_analysis) lawIds.add(law.law_id);
    for (const oo of synthesizedReport.out_of_scope) lawIds.add(oo.law_id);
    if (lawIds.size > 0) {
      const { data: lawRows } = await supabase
        .from("law_catalog")
        .select("id, name_en, name_zh")
        .in("id", Array.from(lawIds));
      for (const row of lawRows ?? []) {
        const r = row as { id: string; name_en: string; name_zh: string };
        lawNameById.set(r.id, locale === "zh" ? r.name_zh || r.name_en : r.name_en);
      }
    }
  }

  return (
    <div className="bg-[color:var(--bg-primary)] text-[color:var(--text-primary)]">
      <ReportPrintTrigger />

      <div className="mx-auto w-full max-w-4xl px-8 py-10 print:max-w-full print:px-6 print:py-6 print:text-[11pt]">
        <header className="mb-8 print:mb-6">
          <div className="flex items-center gap-2 mb-2 text-[color:var(--text-tertiary)]">
            <ShieldCheck className="h-4 w-4 text-[color:var(--accent-warm)]" />
            <span className="text-xs uppercase tracking-wider">Decision Audit Report</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">
            {template ? (locale === "zh" ? template.name_zh : template.name_en) : session.template_slug}
          </h1>
          <div className="text-sm text-[color:var(--text-tertiary)]">
            <div>Session ID: <span className="font-mono">{session.id}</span></div>
            <div>Created: {new Date(session.created_at).toUTCString()}</div>
            {session.completed_at && (
              <div>Completed: {new Date(session.completed_at).toUTCString()}</div>
            )}
          </div>
          {template?.regulation_refs && template.regulation_refs[0] !== "(general)" && (
            <div className="flex flex-wrap gap-1.5 mt-2">
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
        </header>

        <section className="mb-8 print:mb-6 break-inside-avoid">
          <h2 className="text-lg font-semibold mb-2">Decision text</h2>
          <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-4">
            {session.decision_text}
          </pre>
          <div className="text-[10px] text-[color:var(--text-tertiary)] mt-1 font-mono">
            sha256: {session.decision_text_sha256}
          </div>
        </section>

        {synthesizedReport && (
          <SynthesizedReportSection
            report={synthesizedReport}
            lawNameById={lawNameById}
            t={t}
          />
        )}

        <section className="mb-8 print:mb-6">
          <h2 className="text-lg font-semibold mb-3">Risk Register</h2>
          {findings.length === 0 ? (
            <p className="text-sm text-[color:var(--text-tertiary)]">No findings recorded.</p>
          ) : (
            <div className="space-y-5">
              {(["risk", "blind_spot", "dissent", "mitigation", "no_risk"] as AuditFindingKind[]).map((kind) => {
                const list = findingsByKind.get(kind) ?? [];
                if (list.length === 0) return null;
                return (
                  <div key={kind} className="space-y-2">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-[color:var(--text-tertiary)]">
                      {kindLabel(kind)} · {list.length}
                    </h3>
                    <table className="w-full text-sm border border-[color:var(--border-default)]">
                      <thead>
                        <tr className="bg-[color:var(--bg-secondary)] text-xs">
                          <th className="text-left px-3 py-2 w-[18%]">Persona</th>
                          <th className="text-left px-3 py-2 w-[8%]">S × P</th>
                          <th className="text-left px-3 py-2">Claim</th>
                          <th className="text-left px-3 py-2 w-[18%]">Disposition</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((f) => (
                          <tr key={f.id} className="border-t border-[color:var(--border-default)] break-inside-avoid">
                            <td className="px-3 py-2 align-top text-xs text-[color:var(--text-tertiary)]">
                              {personaMap.get(f.persona_id) ?? f.persona_id}
                            </td>
                            <td className="px-3 py-2 align-top font-mono text-xs">
                              {f.severity ?? "—"} × {f.probability ?? "—"}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="leading-relaxed">{f.claim}</div>
                              {f.suggested_mitigation && (
                                <div className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                                  <strong>Mitigation:</strong> {f.suggested_mitigation}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top text-xs">
                              {f.user_disposition ? (
                                <>
                                  <div className="font-medium">{dispositionLabel(f.user_disposition)}</div>
                                  {f.user_disposition_note && (
                                    <div className="text-[color:var(--text-tertiary)] mt-0.5">{f.user_disposition_note}</div>
                                  )}
                                </>
                              ) : (
                                <span className="text-[color:var(--text-tertiary)]">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-8 print:mb-6 break-inside-avoid">
          <h2 className="text-lg font-semibold mb-3">Sign-off</h2>
          {signoffs.length === 0 ? (
            <p className="text-sm text-[color:var(--text-tertiary)]">Not yet signed off.</p>
          ) : (
            <table className="w-full text-sm border border-[color:var(--border-default)]">
              <thead>
                <tr className="bg-[color:var(--bg-secondary)] text-xs">
                  <th className="text-left px-3 py-2">Signature</th>
                  <th className="text-left px-3 py-2">Role</th>
                  <th className="text-left px-3 py-2">Signed at (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {signoffs.map((s) => (
                  <tr key={s.id} className="border-t border-[color:var(--border-default)]">
                    <td className="px-3 py-2 font-medium">{s.signature}</td>
                    <td className="px-3 py-2">{s.role}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {new Date(s.created_at).toUTCString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="break-inside-avoid">
          <h2 className="text-lg font-semibold mb-2">Audit trail (hash-chained)</h2>
          <p className="text-xs text-[color:var(--text-tertiary)] mb-1">
            {t("auditTrailVerifyHint")} Final head hash:{" "}
            <span className="font-mono">{session.audit_trail_head_hash ?? "—"}</span>
          </p>
          {session.status === "signed_off" && (
            <p className="text-xs text-[color:var(--text-tertiary)] mb-3 print:mb-2">
              {t("verifyPublicLink")}:{" "}
              <a
                href={`/${locale}/verify/${session.id}`}
                className="font-mono text-[color:var(--text-primary)] underline underline-offset-2 hover:text-[color:var(--accent-warm)] print:no-underline"
              >
                /{locale}/verify/{session.id}
              </a>
              <span className="ml-2 no-print">— {t("verifyPublicLinkHint")}</span>
            </p>
          )}
          <table className="w-full text-xs border border-[color:var(--border-default)] font-mono">
            <thead>
              <tr className="bg-[color:var(--bg-secondary)]">
                <th className="text-left px-2 py-1">#</th>
                <th className="text-left px-2 py-1">action</th>
                <th className="text-left px-2 py-1">ts (UTC)</th>
                <th className="text-left px-2 py-1">payload sha256</th>
                <th className="text-left px-2 py-1">this hash</th>
              </tr>
            </thead>
            <tbody>
              {trail.map((row) => (
                <tr key={row.id} className="border-t border-[color:var(--border-default)] break-inside-avoid">
                  <td className="px-2 py-1">{row.seq}</td>
                  <td className="px-2 py-1">{row.action}</td>
                  <td className="px-2 py-1">{new Date(row.ts).toUTCString()}</td>
                  <td className="px-2 py-1 break-all">{row.payload_sha256.slice(0, 16)}…</td>
                  <td className="px-2 py-1 break-all">{row.this_hash.slice(0, 16)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {synthesizedReport?.disclaimer && (
          <section className="mt-10 mb-4 break-inside-avoid rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-4 py-3 print:bg-white">
            <div className="text-[10px] uppercase tracking-wider text-[color:var(--text-tertiary)] mb-1">
              {t("reportDisclaimerLabel")}
            </div>
            <p className="text-xs leading-relaxed text-[color:var(--text-secondary)]">
              {synthesizedReport.disclaimer}
            </p>
          </section>
        )}

        <footer className="mt-10 text-[10px] text-[color:var(--text-tertiary)]">
          Generated by Hygge Decision Audit · {new Date().toUTCString()}
        </footer>
      </div>

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          table, th, td { border-color: #444 !important; }
          th { background: #f0f0f0 !important; }
        }
        @page { margin: 18mm 14mm; }
      `}</style>
    </div>
  );
}

function kindLabel(kind: AuditFindingKind): string {
  return ({
    risk: "Risk",
    blind_spot: "Blind spot",
    dissent: "Dissent",
    mitigation: "Mitigation",
    no_risk: "No risk found",
  } as const)[kind];
}

function dispositionLabel(d: string): string {
  return ({
    accept_mitigation: "Accept mitigation",
    accept_residual: "Accept residual risk",
    reject: "Rejected",
    defer: "Deferred",
  } as Record<string, string>)[d] ?? d;
}

function isSynthesizedReport(v: unknown): v is SynthesizedReport {
  if (!v || typeof v !== "object") return false;
  const r = v as Partial<SynthesizedReport>;
  return (
    typeof r.executive_summary === "string" &&
    Array.isArray(r.in_scope_analysis) &&
    Array.isArray(r.out_of_scope) &&
    Array.isArray(r.open_questions) &&
    typeof r.disclaimer === "string"
  );
}

function SynthesizedReportSection({
  report,
  lawNameById,
  t,
}: {
  report: SynthesizedReport;
  lawNameById: Map<string, string>;
  t: Awaited<ReturnType<typeof getTranslations<"audit">>>;
}) {
  return (
    <section className="mb-8 print:mb-6">
      <h2 className="text-lg font-semibold mb-3">
        {t("reportSynthesisTitle")}
      </h2>

      <div className="rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-4 mb-4 print:bg-white">
        <div className="text-[10px] uppercase tracking-wider text-[color:var(--text-tertiary)] mb-1">
          {t("reportExecutiveSummaryLabel")}
        </div>
        <p className="text-sm leading-relaxed">{report.executive_summary}</p>
      </div>

      {report.in_scope_analysis.length > 0 && (
        <div className="space-y-3 mb-4">
          <h3 className="text-sm font-medium uppercase tracking-wider text-[color:var(--text-tertiary)]">
            {t("reportInScopeLabel")} · {report.in_scope_analysis.length}
          </h3>
          {report.in_scope_analysis.map((law) => (
            <SynthLawCard
              key={law.law_id}
              law={law}
              lawName={lawNameById.get(law.law_id) ?? law.law_id}
              t={t}
            />
          ))}
        </div>
      )}

      {report.out_of_scope.length > 0 && (
        <div className="rounded-lg border border-[color:var(--border-default)] p-4 mb-4 break-inside-avoid">
          <h3 className="text-sm font-medium uppercase tracking-wider text-[color:var(--text-tertiary)] mb-2">
            {t("reportOutOfScopeLabel")} · {report.out_of_scope.length}
          </h3>
          <ul className="space-y-1.5 text-sm">
            {report.out_of_scope.map((oo) => (
              <li key={oo.law_id} className="leading-relaxed">
                <span className="font-mono text-xs text-[color:var(--text-tertiary)]">
                  {lawNameById.get(oo.law_id) ?? oo.law_id}
                </span>
                <span className="text-[color:var(--text-tertiary)]"> — </span>
                <span>{oo.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.open_questions.length > 0 && (
        <div className="rounded-lg border border-[color:var(--border-default)] p-4 break-inside-avoid">
          <h3 className="text-sm font-medium uppercase tracking-wider text-[color:var(--text-tertiary)] mb-2">
            {t("reportOpenQuestionsLabel")} · {report.open_questions.length}
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {report.open_questions.map((q, i) => (
              <li key={i} className="leading-relaxed">
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SynthLawCard({
  law,
  lawName,
  t,
}: {
  law: SynthLaw;
  lawName: string;
  t: Awaited<ReturnType<typeof getTranslations<"audit">>>;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--border-default)] p-4 break-inside-avoid">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="text-sm font-semibold">{lawName}</div>
        <ComplianceBadge compliance={law.overall_compliance} t={t} />
      </div>
      {law.findings.length === 0 ? (
        <p className="text-xs text-[color:var(--text-tertiary)]">
          {t("reportLawNoFindings")}
        </p>
      ) : (
        <ul className="space-y-3">
          {law.findings.map((f, i) => (
            <li
              key={i}
              className="border-t border-[color:var(--border-default)] pt-3 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-mono uppercase rounded border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-1.5 py-0.5 text-[color:var(--text-tertiary)]">
                  {f.section}
                </span>
                <ConfidenceBadge confidence={f.confidence} t={t} />
                <BasisBadge basis={f.basis} t={t} />
                {f.stale && <StaleBadge t={t} />}
                {f.severity != null && f.probability != null && (
                  <span className="text-[10px] font-mono text-[color:var(--text-tertiary)]">
                    S{f.severity}×P{f.probability}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed">{f.claim}</p>
              {f.suggested_mitigation && (
                <div className="mt-1.5 text-xs text-[color:var(--text-tertiary)]">
                  <strong className="text-[color:var(--text-secondary)]">
                    {t("reportFindingMitigationLabel")}:
                  </strong>{" "}
                  {f.suggested_mitigation}
                </div>
              )}
              {f.dissent && (
                <div className="mt-1.5 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-xs">
                  <strong className="text-amber-700 dark:text-amber-400">
                    {t("reportFindingDissentLabel")}:
                  </strong>{" "}
                  <span className="text-[color:var(--text-secondary)]">
                    {f.dissent}
                  </span>
                </div>
              )}
              {f.citations.length > 0 && (
                <div className="mt-2 space-y-1">
                  {f.citations.map((c, j) => (
                    <a
                      key={j}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[11px] text-[color:var(--text-tertiary)] hover:text-[color:var(--accent-warm)] print:text-black"
                    >
                      <span className="font-medium">[{j + 1}]</span> {c.title}
                      {c.published_at && (
                        <span className="ml-1 opacity-70">
                          · {c.published_at.slice(0, 10)}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ComplianceBadge({
  compliance,
  t,
}: {
  compliance: OverallCompliance;
  t: Awaited<ReturnType<typeof getTranslations<"audit">>>;
}) {
  const cls =
    compliance === "compliant"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : compliance === "non_compliant"
        ? "border-[#F87171]/40 bg-[#F87171]/10 text-[#F87171]"
        : compliance === "partial"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] text-[color:var(--text-tertiary)]";
  const label =
    compliance === "compliant"
      ? t("reportComplianceCompliant")
      : compliance === "non_compliant"
        ? t("reportComplianceNonCompliant")
        : compliance === "partial"
          ? t("reportCompliancePartial")
          : t("reportComplianceUnknown");
  return (
    <span
      className={`inline-flex items-center text-[10px] uppercase tracking-wider rounded-full border px-2 py-0.5 ${cls}`}
    >
      {label}
    </span>
  );
}

function ConfidenceBadge({
  confidence,
  t,
}: {
  confidence: FindingConfidence;
  t: Awaited<ReturnType<typeof getTranslations<"audit">>>;
}) {
  const label =
    confidence === "settled"
      ? t("reportConfidenceSettled")
      : confidence === "unsettled"
        ? t("reportConfidenceUnsettled")
        : t("reportConfidenceSpeculative");
  return (
    <span className="inline-flex items-center text-[10px] uppercase rounded border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-1.5 py-0.5 text-[color:var(--text-tertiary)]">
      {label}
    </span>
  );
}

function BasisBadge({
  basis,
  t,
}: {
  basis: FindingBasis;
  t: Awaited<ReturnType<typeof getTranslations<"audit">>>;
}) {
  const label = ({
    statute: t("reportBasisStatute"),
    regulation: t("reportBasisRegulation"),
    agency_guidance: t("reportBasisAgencyGuidance"),
    case_law: t("reportBasisCaseLaw"),
    secondary_source: t("reportBasisSecondarySource"),
  } as Record<FindingBasis, string>)[basis];
  return (
    <span className="inline-flex items-center text-[10px] uppercase rounded border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-1.5 py-0.5 text-[color:var(--text-tertiary)]">
      {label}
    </span>
  );
}

function StaleBadge({
  t,
}: {
  t: Awaited<ReturnType<typeof getTranslations<"audit">>>;
}) {
  return (
    <span className="inline-flex items-center text-[10px] uppercase rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">
      {t("reportStaleBadge")}
    </span>
  );
}
