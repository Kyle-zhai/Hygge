import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/stripe/plans";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("persona_squads")
    .select("id, name, persona_ids, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ squads: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitResponse = await enforceRateLimit("personas", user.id);
  if (limitResponse) return limitResponse;

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const personaIds: unknown = body.personaIds;

  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Name must be 1-60 characters" }, { status: 400 });
  }
  if (!Array.isArray(personaIds) || personaIds.length === 0) {
    return NextResponse.json({ error: "personaIds required" }, { status: 400 });
  }
  if (!personaIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "personaIds must be strings" }, { status: 400 });
  }

  const { data: sub } = await supabase
    .from("subscriptions").select("plan").eq("user_id", user.id).single();
  const planKey = (sub?.plan ?? "free") as keyof typeof PLANS;
  const planConfig = PLANS[planKey] ?? PLANS.free;
  if (personaIds.length > planConfig.maxPersonas) {
    return NextResponse.json(
      { error: `Max ${planConfig.maxPersonas} personas on ${planKey} plan` },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("persona_squads")
    .insert({ user_id: user.id, name, persona_ids: personaIds })
    .select("id, name, persona_ids, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ squad: data }, { status: 201 });
}
