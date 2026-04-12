import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/stripe/plans";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .single();

  const plan = subscription?.plan ?? "free";
  const planConfig = PLANS[plan as keyof typeof PLANS] ?? PLANS.free;

  if (!planConfig.features.marketplacePublish) {
    return NextResponse.json({ error: "Publishing requires a Pro or Max plan" }, { status: 403 });
  }

  const { data: persona } = await supabase
    .from("personas")
    .select("id, creator_id, is_custom")
    .eq("id", id)
    .single();

  if (!persona || persona.creator_id !== user.id) {
    return NextResponse.json({ error: "Persona not found or not owned by you" }, { status: 404 });
  }

  if (!persona.is_custom) {
    return NextResponse.json({ error: "Only custom personas can be published" }, { status: 400 });
  }

  const { error } = await supabase
    .from("personas")
    .update({ is_public: true })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Published to marketplace" });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: persona } = await supabase
    .from("personas")
    .select("id, creator_id")
    .eq("id", id)
    .single();

  if (!persona || persona.creator_id !== user.id) {
    return NextResponse.json({ error: "Not found or not owned" }, { status: 404 });
  }

  await supabase
    .from("personas")
    .update({ is_public: false })
    .eq("id", id);

  return NextResponse.json({ message: "Unpublished from marketplace" });
}
