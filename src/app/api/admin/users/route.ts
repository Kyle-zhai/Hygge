import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 15;

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const emailQuery = url.searchParams.get("email")?.trim().toLowerCase();
  if (!emailQuery) {
    return NextResponse.json({ error: "email query param required" }, { status: 400 });
  }

  const sb = createAdminClient();

  // listUsers paginates; scan up to 5 pages (5000 users) before giving up.
  let match: { id: string; email: string; created_at: string } | null = null;
  for (let page = 1; page <= 5 && !match; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const found = data.users.find((u) => u.email?.toLowerCase() === emailQuery);
    if (found) {
      match = { id: found.id, email: found.email!, created_at: found.created_at };
    }
    if (data.users.length < 1000) break;
  }

  console.log("admin.user_searched", { actor: admin.email, query: emailQuery, found: !!match });

  if (!match) return NextResponse.json({ user: null });

  const [{ data: subscription }, { data: evaluations }, { count: personaCount }] = await Promise.all([
    sb
      .from("subscriptions")
      .select("plan, evaluations_used, evaluations_limit, current_period_end, stripe_subscription_id")
      .eq("user_id", match.id)
      .maybeSingle(),
    sb
      .from("evaluations")
      .select("id, status, mode, created_at, error_message")
      .order("created_at", { ascending: false })
      .limit(10)
      .in(
        "project_id",
        ((await sb.from("projects").select("id").eq("user_id", match.id)).data ?? []).map((p) => p.id),
      ),
    sb
      .from("personas")
      .select("id", { count: "exact", head: true })
      .eq("created_by", match.id),
  ]);

  return NextResponse.json({
    user: match,
    subscription,
    recentEvaluations: evaluations ?? [],
    personaCount: personaCount ?? 0,
  });
}
