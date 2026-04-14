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
    .select("report_data")
    .eq("evaluation_id", evalId!)
    .single();

  const reportEntries = (summaryReport?.report_data as any)?.persona_analysis?.entries || [];
  const reportEntryIds = reportEntries.map((e: any) => ({ persona_id: e.persona_id, persona_name: e.persona_name }));
  const consensusPersonas = (summaryReport?.report_data as any)?.persona_analysis?.consensus?.flatMap((c: any) => c.supporting_personas || []) || [];

  return NextResponse.json({
    selectedIds,
    selectedIdsTypes: selectedIds?.map((id: any) => typeof id),
    reviewPersonaIds,
    reviewPersonaIdsTypes: reviewPersonaIds.map((id: any) => typeof id),
    personasBySelected: { count: personasBySelected?.length, data: personasBySelected, error: e1 },
    personasByReview: { count: personasByReview?.length, data: personasByReview, error: e2 },
    personasByStringIds: { count: personasByStringIds?.length, data: personasByStringIds, error: e3 },
    samplePersonaIds: allPersonas?.map((p: any) => p.id),
    reportEntryIds,
    consensusPersonas,
  });
}
