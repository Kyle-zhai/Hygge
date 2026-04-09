import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Routes that require authentication
const protectedRoutes = ["/dashboard", "/evaluate", "/settings"];

// Routes that should redirect to dashboard if already logged in
const authRoutes = ["/auth/login", "/auth/register"];

export async function proxy(request: NextRequest) {
  // Run i18n middleware first to get locale-aware response
  const response = intlMiddleware(request);

  // Run Supabase session refresh
  const { user } = await updateSession(request, response);

  const { pathname } = request.nextUrl;
  // Strip locale prefix for route matching
  const pathnameWithoutLocale = pathname.replace(/^\/(zh|en)/, "") || "/";

  // Redirect unauthenticated users away from protected routes
  const isProtected = protectedRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );
  if (isProtected && !user) {
    const locale = pathname.startsWith("/en") ? "en" : "zh";
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/auth/login`;
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth routes
  const isAuthRoute = authRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );
  if (isAuthRoute && user) {
    const locale = pathname.startsWith("/en") ? "en" : "zh";
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/dashboard`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/", "/(zh|en)/:path*"],
};
