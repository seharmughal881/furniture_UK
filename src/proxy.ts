import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin/cookie";

/**
 * Proxy (what earlier Next versions called middleware -- renamed in Next 16, and it lives
 * in src/ because this project keeps its app directory there).
 *
 * This is a cheap redirect, NOT the security boundary. It only asks whether an admin
 * session cookie is present; it never validates it, and it deliberately does not touch
 * the database, because it runs on every matching request and the pool is capped at 5
 * connections on Vercel (src/lib/db.ts).
 *
 * The real check is requireAdmin() in src/lib/admin/session.ts, called by every exported
 * function in src/lib/admin/orders.ts before it reads or writes anything.
 */
export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // The login page must stay reachable without a session, or signing in is impossible.
  if (pathname === "/admin/login") return NextResponse.next();

  if (request.cookies.has(ADMIN_COOKIE)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  // Remember where they were heading so login can send them back there.
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}
