import { NextResponse } from "next/server";
import { getSponsors } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sponsors = await getSponsors();
  return NextResponse.json(sponsors.filter((s) => s.active));
}
