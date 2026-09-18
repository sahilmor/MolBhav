import { NextRequest, NextResponse } from "next/server";
import { getAdminConfig, setAdminConfig, redisConfigured } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_RATE = 0.0001;
const MAX_RATE = 0.05;

export async function GET() {
  return NextResponse.json({ config: await getAdminConfig(), redisConfigured });
}

export async function PATCH(req: NextRequest) {
  let body: { campaignActive?: unknown; savageBossWinRateOverride?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const current = await getAdminConfig();
  const next = { ...current };

  if (body.campaignActive !== undefined) {
    if (typeof body.campaignActive !== "boolean") {
      return NextResponse.json({ error: "campaignActive must be a boolean." }, { status: 400 });
    }
    next.campaignActive = body.campaignActive;
  }

  if (body.savageBossWinRateOverride !== undefined) {
    const rate = Number(body.savageBossWinRateOverride);
    if (!Number.isFinite(rate) || rate < MIN_RATE || rate > MAX_RATE) {
      return NextResponse.json(
        { error: `Win rate must be between ${MIN_RATE} and ${MAX_RATE}.` },
        { status: 400 }
      );
    }
    next.savageBossWinRateOverride = rate;
  }

  await setAdminConfig(next);
  return NextResponse.json({ config: next, redisConfigured });
}
