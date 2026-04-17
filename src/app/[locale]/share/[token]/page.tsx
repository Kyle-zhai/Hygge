import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { ReportView } from "@/components/evaluation/report-view";

export const dynamic = "force-dynamic";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  const supabase = adminClient();

  const { data: evaluation } = await supabase
    .from("evaluations")
    .select(`id, status, mode, topic_classification, selected_persona_ids, shared_at,
      persona_reviews (id, persona_id, scores, review_text, strengths, weaknesses, llm_model, created_at, overall_stance, cited_references),
      summary_reports (*)`)
    .eq("share_token", token)
    .eq("status", "completed")
    .single();

  if (!evaluation) {
    notFound();
  }

  const reviews = (evaluation as any).persona_reviews ?? [];
  const personaIds = Array.from(
    new Set([
      ...(Array.isArray(evaluation.selected_persona_ids) ? evaluation.selected_persona_ids : []).map(String),
      ...reviews.map((r: any) => String(r.persona_id)),
    ]),
  );

  let personas: any[] = [];
  if (personaIds.length > 0) {
    const { data } = await supabase
      .from("personas")
      .select("id, identity, demographics, category")
      .in("id", personaIds);
    personas = data ?? [];
  }

  const reportData = (evaluation as any).summary_reports;
  const report = Array.isArray(reportData) ? reportData[0] ?? null : reportData ?? null;
  const topicClassification = (evaluation as any).topic_classification ?? null;

  const banner =
    locale === "zh"
      ? "这是一份只读的分享报告。"
      : "This is a read-only shared report.";
  const cta = locale === "zh" ? "创建你自己的评估" : "Create your own evaluation";

  return (
    <div>
      <div className="border-b border-[#2A2A2A] bg-[#141414]/60 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-xs text-[#9B9594]">{banner}</span>
          <Link
            href={`/${locale}`}
            className="text-xs font-medium text-[#C4A882] hover:text-[#D4B892]"
          >
            {cta} →
          </Link>
        </div>
      </div>
      <ReportView
        report={report}
        reviews={reviews}
        personas={personas}
        locale={locale}
        topicClassification={topicClassification}
        mode={evaluation.mode === "topic" ? "topic" : "product"}
      />
    </div>
  );
}
