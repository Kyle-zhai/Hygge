import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Default landing post-OAuth callback. /evaluate/new is now retired —
// /decide/new is the live flow as of the 2026-05-06 reverse pivot.
const DEFAULT_POST_CALLBACK = "/en/decide/new";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");

  // Same-origin guard against open redirect via OAuth callback.
  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : DEFAULT_POST_CALLBACK;

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${safeNext}`);
      }
      console.error("[auth/callback] Code exchange error:", error.message);
    } catch (err) {
      console.error("[auth/callback] Unexpected error:", err);
    }
  }

  return NextResponse.redirect(`${origin}/en/auth/login`);
}
