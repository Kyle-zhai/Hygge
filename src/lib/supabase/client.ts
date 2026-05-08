import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Realtime channels read tables that are RLS-gated by the authenticated
// user. The Supabase realtime transport only sends the anon key by
// default; without an access_token the WebSocket handshake fails with
// "HTTP Authentication failed; no valid credentials available" and every
// channel.subscribe() silently never delivers a payload. We hydrate
// realtime auth from the active session on creation and keep it in sync
// on every auth state change.
//
// Cached at module scope so the auth listener attaches once per tab,
// not on every render. createBrowserClient reads the session from
// cookies, so all consumers see the same login state regardless of
// which import path they came in through.

let cached: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (cached) return cached;

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  void client.auth.getSession().then(({ data }) => {
    if (data.session?.access_token) {
      client.realtime.setAuth(data.session.access_token);
    }
  });

  client.auth.onAuthStateChange((_event, session) => {
    client.realtime.setAuth(session?.access_token ?? null);
  });

  cached = client;
  return client;
}
