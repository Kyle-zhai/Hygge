import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectDescription, mode } = await request.json();

  if (!projectDescription) {
    return NextResponse.json({ error: "projectDescription is required" }, { status: 400 });
  }

  const validCategories = mode === "topic"
    ? ["general"]
    : ["technical", "product", "design", "end_user", "business"];

  const { data: personas } = await supabase
    .from("personas")
    .select("id, identity, demographics, evaluation_lens")
    .eq("is_active", true)
    .in("category", validCategories);

  if (!personas?.length) {
    return NextResponse.json({ recommended_ids: [], reasoning: "No personas available" });
  }

  const personaSummaries = personas.map((p: any) => ({
    id: p.id,
    name: p.identity.name,
    occupation: p.demographics.occupation,
    primary_question: p.evaluation_lens.primary_question,
  }));

  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SHARED_SECRET;

  if (!workerUrl || !workerSecret) {
    return NextResponse.json({
      recommended_ids: personas.slice(0, 5).map((p: any) => p.id),
      reasoning: "Default recommendation (worker not configured)",
    });
  }

  try {
    const workerRes = await fetch(`${workerUrl.replace(/\/$/, "")}/recommend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": workerSecret,
      },
      body: JSON.stringify({ projectDescription, personas: personaSummaries }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!workerRes.ok) throw new Error(`Worker error ${workerRes.status}`);
    return NextResponse.json(await workerRes.json());
  } catch {
    return NextResponse.json({
      recommended_ids: personas.slice(0, 5).map((p: any) => p.id),
      reasoning: "Default recommendation (worker unavailable)",
    });
  }
}
