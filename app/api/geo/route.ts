import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim();
    const url = ip ? `http://ip-api.com/json/${ip}` : `http://ip-api.com/json/`;
    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json({ city: data.status === "success" ? data.city : null });
  } catch {
    return NextResponse.json({ city: null });
  }
}
