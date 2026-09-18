import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials, toPublic } from "@/lib/users";
import { isDbUnreachable } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_MS, createSessionToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

// Per-instance rate limiting; resets on cold start / redeploy.
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Auth is not configured on the server." }, { status: 503 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = rateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSec / 60)} min.` },
      { status: 429 }
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  try {
    const user = await verifyCredentials(email, password);
    // One message for both cases, so this can't be used to enumerate accounts.
    if (!user) {
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    }

    attempts.delete(ip);

    const res = NextResponse.json({ user: toPublic(user) });
    res.cookies.set(
      SESSION_COOKIE,
      await createSessionToken({ sub: user.id, email: user.email, role: user.role }, secret),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
      }
    );
    return res;
  } catch (e) {
    console.error("Login failed:", e);
    if (isDbUnreachable(e)) {
      return NextResponse.json(
        { error: "Can't reach the database — this is a server problem, not your password." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Couldn't sign you in. Try again." }, { status: 500 });
  }
}
