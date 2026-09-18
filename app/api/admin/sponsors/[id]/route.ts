import { NextRequest, NextResponse } from "next/server";
import { getSponsors, setSponsors } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { active?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const sponsors = await getSponsors();
  const idx = sponsors.findIndex((s) => s.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found." }, { status: 404 });

  sponsors[idx] = {
    ...sponsors[idx],
    active: typeof body.active === "boolean" ? body.active : !sponsors[idx].active,
  };
  await setSponsors(sponsors);
  return NextResponse.json(sponsors[idx]);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sponsors = await getSponsors();
  const next = sponsors.filter((s) => s.id !== id);
  if (next.length === sponsors.length) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  await setSponsors(next);
  return NextResponse.json({ ok: true });
}
