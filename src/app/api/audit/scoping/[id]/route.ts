import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 10;

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS on audit_scoping_sessions already filters by audit_session ownership.
  // No need for an extra ownership check; if RLS hides it the row simply
  // doesn't return.
  const { data, error } = await supabase
    .from("audit_scoping_sessions")
    .select(
      "id, audit_session_id, status, passages, cursor, conversation, pending_question, scope_in, scope_out, question_count, max_questions, error_message, created_at, updated_at, scope_locked_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(data);
}
