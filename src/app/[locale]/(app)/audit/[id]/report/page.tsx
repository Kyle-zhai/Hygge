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

  return (
    <div className="bg-background text-foreground">
      <ReportPrintTrigger />

      <div className="mx-auto w-full max-w-4xl px-8 py-10 print:max-w-full print:px-6 print:py-6 print:text-[11pt]">
        <header className="mb-8 print:mb-6">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Decision Audit Report</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">
            {template ? (locale === "zh" ? template.name_zh : template.name_en) : session.template_slug}
          </h1>
          <div className="text-sm text-muted-foreground">
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
                  className="text-[11px] rounded border border-border bg-background/40 px-1.5 py-0.5 text-muted-foreground"
                >
                  {ref}
                </span>
              ))}
            </div>
          )}
        </header>

        <section className="mb-8 print:mb-6 break-inside-avoid">
          <h2 className="text-lg font-semibold mb-2">Decision text</h2>
          <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed rounded border border-border bg-card/30 p-4">
            {session.decision_text}
          </pre>
          <div className="text-[10px] text-muted-foreground mt-1 font-mono">
            sha256: {session.decision_text_sha256}
          </div>
        </section>

        <section className="mb-8 print:mb-6">
          <h2 className="text-lg font-semibold mb-3">Risk Register</h2>
          {findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No findings recorded.</p>
          ) : (
            <div className="space-y-5">
              {(["risk", "blind_spot", "dissent", "mitigation", "no_risk"] as AuditFindingKind[]).map((kind) => {
                const list = findingsByKind.get(kind) ?? [];
                if (list.length === 0) return null;
                return (
                  <div key={kind} className="space-y-2">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                      {kindLabel(kind)} · {list.length}
                    </h3>
                    <table className="w-full text-sm border border-border">
                      <thead>
                        <tr className="bg-muted/30 text-xs">
                          <th className="text-left px-3 py-2 w-[18%]">Persona</th>
                          <th className="text-left px-3 py-2 w-[8%]">S × P</th>
                          <th className="text-left px-3 py-2">Claim</th>
                          <th className="text-left px-3 py-2 w-[18%]">Disposition</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((f) => (
                          <tr key={f.id} className="border-t border-border break-inside-avoid">
                            <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                              {personaMap.get(f.persona_id) ?? f.persona_id}
                            </td>
                            <td className="px-3 py-2 align-top font-mono text-xs">
                              {f.severity ?? "—"} × {f.probability ?? "—"}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="leading-relaxed">{f.claim}</div>
                              {f.suggested_mitigation && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  <strong>Mitigation:</strong> {f.suggested_mitigation}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top text-xs">
                              {f.user_disposition ? (
                                <>
                                  <div className="font-medium">{dispositionLabel(f.user_disposition)}</div>
                                  {f.user_disposition_note && (
                                    <div className="text-muted-foreground mt-0.5">{f.user_disposition_note}</div>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground">—</span>
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
            <p className="text-sm text-muted-foreground">Not yet signed off.</p>
          ) : (
            <table className="w-full text-sm border border-border">
              <thead>
                <tr className="bg-muted/30 text-xs">
                  <th className="text-left px-3 py-2">Signature</th>
                  <th className="text-left px-3 py-2">Role</th>
                  <th className="text-left px-3 py-2">Signed at (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {signoffs.map((s) => (
                  <tr key={s.id} className="border-t border-border">
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
          <p className="text-xs text-muted-foreground mb-3">
            {t("auditTrailVerifyHint")} Final head hash:{" "}
            <span className="font-mono">{session.audit_trail_head_hash ?? "—"}</span>
          </p>
          <table className="w-full text-xs border border-border font-mono">
            <thead>
              <tr className="bg-muted/30">
                <th className="text-left px-2 py-1">#</th>
                <th className="text-left px-2 py-1">action</th>
                <th className="text-left px-2 py-1">ts (UTC)</th>
                <th className="text-left px-2 py-1">payload sha256</th>
                <th className="text-left px-2 py-1">this hash</th>
              </tr>
            </thead>
            <tbody>
              {trail.map((row) => (
                <tr key={row.id} className="border-t border-border break-inside-avoid">
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

        <footer className="mt-10 text-[10px] text-muted-foreground">
          Generated by Hygge Decision Audit · {new Date().toUTCString()}
        </footer>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
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
