import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const evalId = searchParams.get("eval");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const { data: evaluation, error: evalError } = await supabase
    .from("evaluations")
    .select("id, selected_persona_ids, persona_reviews (id, persona_id)")
    .eq("id", evalId!)
    .single();

  if (evalError) return NextResponse.json({ evalError });

  const selectedIds = evaluation.selected_persona_ids;
  const reviewPersonaIds = (evaluation as any).persona_reviews?.map((r: any) => r.persona_id) || [];

  const { data: personasBySelected, error: e1 } = await supabase
    .from("personas")
    .select("id, identity->name")
    .in("id", selectedIds || []);

  const { data: personasByReview, error: e2 } = reviewPersonaIds.length > 0
    ? await supabase.from("personas").select("id, identity->name").in("id", reviewPersonaIds)
    : { data: [], error: null };

  const { data: personasByStringIds, error: e3 } = await supabase
    .from("personas")
    .select("id, identity->name")
    .in("id", (selectedIds || []).map(String));

  const { data: allPersonas } = await supabase
    .from("personas")
    .select("id")
    .limit(5);

  const { data: summaryReport } = await supabase
    .from("summary_reports")
    .select("persona_analysis, overall_score")
    .eq("evaluation_id", evalId!)
    .single();

  const personaAnalysis = summaryReport?.persona_analysis as any;
  const personaAnalysisKeys = personaAnalysis ? Object.keys(personaAnalysis) : [];
  const reportEntries = personaAnalysis?.entries || [];
  const firstEntry = reportEntries[0] ? Object.keys(reportEntries[0]) : [];
  const rawEntries = reportEntries.slice(0, 2);
  const consensus = personaAnalysis?.consensus;
  const consensusType = typeof consensus;
  const firstConsensus = Array.isArray(consensus) && consensus[0] ? { type: typeof consensus[0], keys: typeof consensus[0] === "object" ? Object.keys(consensus[0]) : null, value: consensus[0] } : null;

  return NextResponse.json({
    selectedIds,
    selectedIdsTypes: selectedIds?.map((id: any) => typeof id),
    reviewPersonaIds,
    reviewPersonaIdsTypes: reviewPersonaIds.map((id: any) => typeof id),
    personasBySelected: { count: personasBySelected?.length, data: personasBySelected, error: e1 },
    personasByReview: { count: personasByReview?.length, data: personasByReview, error: e2 },
    personasByStringIds: { count: personasByStringIds?.length, data: personasByStringIds, error: e3 },
    samplePersonaIds: allPersonas?.map((p: any) => p.id),
    overallScore: summaryReport?.overall_score,
    personaAnalysisKeys,
    firstEntryKeys: firstEntry,
    rawEntries,
    consensusType,
    firstConsensus,
  });
}
