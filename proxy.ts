import { NextRequest, NextResponse } from "next/server";

// Simple shared-password gate. Cron and API routes carry their own
// CRON_SECRET bearer check and are excluded here so Vercel Cron can call them.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    // No password configured -- fail open rather than lock the owner out
    // of a fresh deploy before env vars are set.
    return NextResponse.next();
  }

  const cookie = req.cookies.get("issue-scout-auth")?.value;
  if (cookie === expected) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
