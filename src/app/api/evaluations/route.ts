// Legacy evaluations API.
// As of the 2026-05-06 reverse pivot, evaluation submissions are retired —
// new analyses go through /api/decisions. GET is preserved so the existing
// /evaluate/[id] read-only history pages keep working.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 10;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: projects } = await supabase
    .from("projects")
    .select(
      `id, raw_input, parsed_data, url, created_at, evaluations (id, status, selected_persona_ids, created_at, completed_at)`,
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ projects });
}

export async function POST() {
  return NextResponse.json(
    {
      error: "gone",
      message:
        "Evaluation submissions have moved to the decision flow. Start at /decide/new.",
      redirect_to: "/decide/new",
    },
    { status: 410 },
  );
}
