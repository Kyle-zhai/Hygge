import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS } from "@/lib/stripe/plans";

export const maxDuration = 10;

const VALID_PLANS = new Set(["free", "pro", "max"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: userId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  const { plan, resetEvaluations } = body as { plan?: string; resetEvaluations?: boolean };

  if (typeof plan === "string") {
    if (!VALID_PLANS.has(plan)) {
      return NextResponse.json({ error: "plan must be free|pro|max" }, { status: 400 });
    }
    updates.plan = plan;
    updates.evaluations_limit = PLANS[plan].evaluationsLimit;
  }

  if (resetEvaluations === true) {
    updates.evaluations_used = 0;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("subscriptions")
    .update(updates)
    .eq("user_id", userId)
    .select("plan, evaluations_used, evaluations_limit")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  console.log("admin.user_updated", {
    actor: admin.email,
    targetUserId: userId,
    updates,
  });

  return NextResponse.json({ subscription: data });
}
