import { NextRequest, NextResponse } from "next/server";

// WMO weather codes -> short plain-English condition.
function conditionFor(code: number): string {
  if (code === 0) return "clear sky";
  if (code >= 1 && code <= 3) return "partly cloudy";
  if (code === 45 || code === 48) return "foggy";
  if (code >= 51 && code <= 67) return "rainy";
  if (code >= 71 && code <= 77) return "snowy";
  if (code >= 80 && code <= 82) return "rain showers";
  if (code >= 95 && code <= 99) return "thunderstorm";
  return "cloudy";
}

const EMPTY = { temperatureC: null, condition: null };

export async function GET(req: NextRequest) {
  try {
    const latRaw = req.nextUrl.searchParams.get("lat");
    const lonRaw = req.nextUrl.searchParams.get("lon");
    if (latRaw === null || lonRaw === null) return NextResponse.json(EMPTY);

    const lat = Number(latRaw);
    const lon = Number(lonRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return NextResponse.json(EMPTY);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return NextResponse.json(EMPTY);

    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
    );
    if (!res.ok) return NextResponse.json(EMPTY);

    const data = await res.json();
    const temp = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;
    if (typeof temp !== "number" || typeof code !== "number") return NextResponse.json(EMPTY);

    return NextResponse.json({ temperatureC: temp, condition: conditionFor(code) });
  } catch {
    return NextResponse.json(EMPTY);
  }
}
