import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/stripe/plans";
import { enforceRateLimit } from "@/lib/rate-limit";
import { SUB_DOMAINS } from "@/lib/personas/taxonomy";
import {
  isMarketplaceKind,
  isProductCategoryKey,
  isSubDomainKey,
} from "@/lib/personas/marketplace-taxonomy";

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitResponse = await enforceRateLimit("personas", user.id);
  if (limitResponse) return limitResponse;

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

  let description: string | undefined;
  let category: string | undefined;
  let tags: string[] | undefined;
  let scenarios: string[] | undefined;
  let kind: string | undefined;
  let subDomain: string | undefined;
  let productCategory: string | undefined;
  try {
    const body = await req.json();
    description = body.description;
    category = body.category;
    tags = Array.isArray(body.tags) ? body.tags : undefined;
    scenarios = Array.isArray(body.scenarios) ? body.scenarios : undefined;
    kind = body.kind;
    subDomain = body.sub_domain;
    productCategory = body.product_category;
  } catch {}

  if (!isMarketplaceKind(kind)) {
    return NextResponse.json(
      { error: "kind must be topic, product, or general" },
      { status: 400 },
    );
  }
  if (kind === "topic" && !isSubDomainKey(subDomain)) {
    return NextResponse.json(
      { error: "sub_domain is required when kind=topic" },
      { status: 400 },
    );
  }
  if (kind === "product" && !isProductCategoryKey(productCategory)) {
    return NextResponse.json(
      { error: "product_category is required when kind=product" },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = { is_public: true };
  if (description) updates.description = description;
  if (category) updates.category = category;
  if (tags) updates.tags = tags;
  if (scenarios) updates.scenarios = scenarios;

  if (kind === "topic") {
    const sub = SUB_DOMAINS.find((s) => s.key === subDomain);
    updates.domain = sub?.domain ?? null;
    updates.sub_domain = subDomain;
    updates.product_category = null;
  } else if (kind === "product") {
    updates.product_category = productCategory;
    updates.domain = null;
    updates.sub_domain = null;
  } else {
    updates.domain = null;
    updates.sub_domain = null;
    updates.product_category = null;
  }

  const admin = getAdminClient();
  const { error } = await admin
    .from("personas")
    .update(updates)
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

  const admin = getAdminClient();
  await admin
    .from("personas")
    .update({ is_public: false })
    .eq("id", id);

  return NextResponse.json({ message: "Unpublished from marketplace" });
}
