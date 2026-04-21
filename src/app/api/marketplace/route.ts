import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isMarketplaceKind,
  isSubDomainKey,
  isProductCategoryKey,
} from "@/lib/personas/marketplace-taxonomy";

export async function GET(request: Request) {
  const supabase = await createClient();
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const tag = url.searchParams.get("tag") ?? "";
  const kindParam = url.searchParams.get("kind") ?? "";
  const subDomainParam = url.searchParams.get("sub_domain") ?? "";
  const productCategoryParam = url.searchParams.get("product_category") ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("personas")
    .select("id, identity, demographics, evaluation_lens, category, description, tags, uses_count, creator_id, source, domain, sub_domain, product_category", { count: "exact" })
    .eq("is_public", true)
    .eq("is_custom", true)
    .order("uses_count", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`identity->>name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (tag) {
    query = query.contains("tags", [tag]);
  }

  if (isMarketplaceKind(kindParam)) {
    if (kindParam === "topic") {
      query = query.not("sub_domain", "is", null);
      if (isSubDomainKey(subDomainParam)) {
        query = query.eq("sub_domain", subDomainParam);
      }
    } else if (kindParam === "product") {
      query = query.not("product_category", "is", null);
      if (isProductCategoryKey(productCategoryParam)) {
        query = query.eq("product_category", productCategoryParam);
      }
    } else {
      query = query.is("sub_domain", null).is("product_category", null);
    }
  }

  const { data: personas, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  let savedIds: string[] = [];
  if (user) {
    const { data: saves } = await supabase
      .from("persona_saves")
      .select("persona_id")
      .eq("user_id", user.id);
    savedIds = saves?.map((s: any) => s.persona_id) ?? [];
  }

  return NextResponse.json({
    personas: (personas ?? []).map((p: any) => ({ ...p, is_saved: savedIds.includes(p.id) })),
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
  });
}
