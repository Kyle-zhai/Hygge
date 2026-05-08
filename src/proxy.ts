import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

const LOCALE_PREFIX_RE = /^\/(en|zh)(?=\/|$)/;

// Routes that require authentication
const protectedRoutes = ["/dashboard", "/evaluate", "/settings", "/decide"];

// Routes that should redirect to dashboard if already logged in
const authRoutes = ["/auth/login", "/auth/register"];

function detectLocale(pathname: string): (typeof routing.locales)[number] {
  const m = pathname.match(LOCALE_PREFIX_RE);
  const candidate = m?.[1];
  return candidate === "zh" ? "zh" : "en";
}

export async function proxy(request: NextRequest) {
  // Run i18n middleware first to get locale-aware response
  const response = intlMiddleware(request);

  // Run Supabase session refresh
  const { user } = await updateSession(request, response);

  const { pathname } = request.nextUrl;
  const locale = detectLocale(pathname);
  // Strip locale prefix for route matching
  const pathnameWithoutLocale = pathname.replace(LOCALE_PREFIX_RE, "") || "/";

  // Redirect unauthenticated users away from protected routes.
  // Preserve the originally-requested path as `next=` so post-login lands
  // them back where they came from (matches the landing page CTAs).
  const isProtected = protectedRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/auth/login`;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth routes. Default landing
  // is /decide/new (post-2026-05-06 reverse pivot); honour ?next= when
  // present so register/login deep links resolve correctly.
  const isAuthRoute = authRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    const nextParam = request.nextUrl.searchParams.get("next");
    // Only honour `next` when it's a same-origin relative path — guards
    // against open-redirect via /auth/login?next=https://attacker.com.
    if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
      url.pathname = nextParam;
      url.search = "";
    } else {
      url.pathname = `/${locale}/decide/new`;
      url.search = "";
    }
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/", "/(en|zh)/:path*"],
};
