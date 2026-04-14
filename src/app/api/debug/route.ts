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

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, evaluations_used, evaluations_limit")
    .eq("user_id", user.id)
    .single();

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
    .select("persona_analysis, overall_score, scenario_simulation, round_table_debate, opinion_drift")
    .eq("evaluation_id", evalId!)
    .single();

  const personaAnalysis = summaryReport?.persona_analysis as any;
  const personaAnalysisKeys = personaAnalysis ? Object.keys(personaAnalysis) : [];
  const reportEntries = personaAnalysis?.entries || [];
  const firstEntryType = reportEntries[0] ? typeof reportEntries[0] : null;
  const firstEntry = reportEntries[0] && typeof reportEntries[0] === "object" ? Object.keys(reportEntries[0]) : reportEntries.slice(0, 4);
  const consensus = personaAnalysis?.consensus;
  const firstConsensus = Array.isArray(consensus) && consensus[0] ? consensus[0] : null;
  const mda = summaryReport ? (summaryReport as any).multi_dimensional_analysis : null;
  const mdaFirstType = Array.isArray(mda) && mda[0] ? typeof mda[0] : null;
  const mdaFirst = Array.isArray(mda) && mda[0] && typeof mda[0] === "object" ? Object.keys(mda[0]) : (Array.isArray(mda) ? mda.slice(0, 3) : null);

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
    entriesCount: reportEntries.length,
    firstEntryType,
    firstEntry,
    firstConsensus,
    mdaFirstType,
    mdaFirst,
    subscriptionPlan: subscription?.plan,
    hasScenarioSimulation: !!summaryReport?.scenario_simulation,
    hasRoundTableDebate: !!summaryReport?.round_table_debate,
    hasOpinionDrift: !!summaryReport?.opinion_drift,
  });
}
