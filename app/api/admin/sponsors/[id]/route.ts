import { NextRequest, NextResponse } from "next/server";
import { getSponsors, setSponsorActive, deleteSponsor } from "@/lib/db";

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

  let active: boolean;
  if (typeof body.active === "boolean") {
    active = body.active;
  } else {
    const current = (await getSponsors()).find((s) => s.id === id);
    if (!current) return NextResponse.json({ error: "Not found." }, { status: 404 });
    active = !current.active;
  }

  const updated = await setSponsorActive(id, active);
  if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const removed = await deleteSponsor(id);
  if (!removed) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
