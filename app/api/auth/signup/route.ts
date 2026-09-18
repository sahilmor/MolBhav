import { NextRequest, NextResponse } from "next/server";
import { createUser, findUserByEmail, normalizeEmail, toPublic } from "@/lib/users";
import { isDbUnreachable } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_MS, createSessionToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Auth is not configured on the server." }, { status: 503 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    if (await findUserByEmail(email)) {
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    }
    // Signup always creates a regular user. Admin is granted separately, never self-served.
    const user = await createUser(email, password, "user");
    const res = NextResponse.json({ user: toPublic(user) }, { status: 201 });
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
    console.error("Signup failed:", e);
    if (isDbUnreachable(e)) {
      return NextResponse.json(
        { error: "Can't reach the database — try again once it's back." },
        { status: 503 }
      );
    }
    // The unique index is the real guard against two concurrent signups racing
    // past the findUserByEmail check above.
    if ((e as { code?: number })?.code === 11000) {
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    }
    return NextResponse.json({ error: "Couldn't create the account. Try again." }, { status: 500 });
  }
}
