import { NextRequest, NextResponse } from "next/server";
import { getSponsors, setSponsors, redisConfigured, type Sponsor } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ sponsors: await getSponsors(), redisConfigured });
}

export async function POST(req: NextRequest) {
  let body: { name?: unknown; emoji?: unknown; discountPercent?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const emoji = typeof body.emoji === "string" ? body.emoji.trim() : "";
  const discountPercent = Number(body.discountPercent);

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 100) {
    return NextResponse.json({ error: "Discount must be between 1 and 100." }, { status: 400 });
  }

  const sponsors = await getSponsors();
  const sponsor: Sponsor = {
    id: crypto.randomUUID(),
    name,
    emoji: emoji || "🎁",
    discountPercent: Math.round(discountPercent),
    active: true,
    createdAt: new Date().toISOString(),
  };
  await setSponsors([...sponsors, sponsor]);
  return NextResponse.json(sponsor, { status: 201 });
}
