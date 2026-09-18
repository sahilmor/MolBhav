import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await verifySessionToken(
    req.cookies.get(SESSION_COOKIE)?.value,
    process.env.ADMIN_SESSION_SECRET
  );
  if (!session) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: session.sub, email: session.email, role: session.role } });
}
