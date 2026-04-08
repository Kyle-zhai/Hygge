import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: personas, error } = await supabase
    .from("personas")
    .select("id, identity, demographics, evaluation_lens, category")
    .eq("is_active", true)
    .order("category");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ personas });
}
