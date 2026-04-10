import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}/en/evaluate/new`);
      }
      console.error("[auth/callback] Code exchange error:", error.message);
    } catch (err) {
      console.error("[auth/callback] Unexpected error:", err);
    }
  }

  return NextResponse.redirect(`${origin}/en/auth/login`);
}
