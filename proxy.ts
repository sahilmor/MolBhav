import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// `middleware.ts` is deprecated in Next 16; this is the `proxy.ts` equivalent.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public auth surfaces.
  if (pathname === "/login" || pathname.startsWith("/api/auth/") || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const session = await verifySessionToken(
    req.cookies.get(SESSION_COOKIE)?.value,
    process.env.ADMIN_SESSION_SECRET
  );

  const isApi = pathname.startsWith("/api/");
  const needsAdmin = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (!session) {
    if (isApi) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // Signed in, but not an admin: keep them out of the control panel.
  if (needsAdmin && session.role !== "admin") {
    if (isApi) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const url = req.nextUrl.clone();
    url.pathname = "/account";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/account/:path*"],
};
