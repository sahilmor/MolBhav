import { NextResponse } from "next/server";
import { pingDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Coarse "can the server reach MongoDB" probe. Returns only a status and a
 * one-word reason — never the URI, credentials or driver internals — so it is
 * safe to leave public. It exists so a broken database is one curl away from
 * being confirmed, instead of being guessed at from a 500 on the login form.
 */
export async function GET() {
  const result = await pingDb();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
