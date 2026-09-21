// Demo mode boots with no Supabase project. `createClient` throws outright
// when the URL or key is empty, which would 500 every server component that
// renders a signed-in/signed-out state (the marketing header, the app
// sidebar) before any demo guard gets a chance to run.
//
// So in demo mode we substitute an inert endpoint instead. The client
// constructs normally and every request against it fails fast — port 1 on
// loopback refuses immediately, with no DNS lookup and no traffic leaving
// the machine. `auth.getUser()` therefore resolves to a null user, which is
// exactly the state demo mode wants.
//
// This never applies outside demo mode: real credentials always win.

import { isDemoMode } from "@/lib/demo";

const INERT_URL = "http://127.0.0.1:1";
const INERT_KEY = "demo-anon-key";

export function resolveSupabaseUrl(): string {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  if (url) return url;
  return isDemoMode() ? INERT_URL : url;
}

export function resolveSupabaseAnonKey(): string {
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (key) return key;
  return isDemoMode() ? INERT_KEY : key;
}
