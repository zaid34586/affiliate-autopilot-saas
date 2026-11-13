import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_HINTS = ["authjs.session-token", "next-auth.session-token"];

function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.getAll().some((c) => SESSION_COOKIE_HINTS.some((hint) => c.name.includes(hint)));
}

/**
 * Optimistic auth checks (no DB — fast).
 * The real security check lives in the dashboard layout's `requireUser()`.
 * Note: Next 16 renamed middleware → proxy (nodejs runtime).
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = hasSessionCookie(req);

  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding");

  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if ((pathname === "/login" || pathname === "/signup") && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/login", "/signup"],
};
