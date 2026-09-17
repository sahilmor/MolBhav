import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Model choice is constrained by what a free-tier key can actually call:
// gemini-1.5-* retired; gemini-2.5-pro 404s ("not available to new users");
// gemini-3.1-pro-preview and gemini-3.5-flash are capped at ~20 requests/day.
// This lite -> full-flash pair is verified working with usable free-tier quota.
const MODEL_FAST = "gemini-3.5-flash-lite";
const MODEL_REASONING = "gemini-2.5-flash";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface UserProfile { name: string; age: number; gender: string; honorific: string; }

interface VendorPersonaBody { name: string; gender: string; ageBand: string; personality: string; }

interface BargainRequestBody {
  game_mode: string;
  asking_price: number;
  current_offer: number;
  user_message: string;
  user_profile: UserProfile;
  vendor_persona: VendorPersonaBody;
  market_name: string;
  item_name: string;
  stage?: string;
  vendor_patience?: number;
  below_floor_strikes?: number;
  weather_temp_c?: number | null;
  weather_condition?: string | null;
}

interface BargainResponseBody {
  vendor_dialogue: string;
  emotional_state: string;
  patience_remaining: number;
  current_counter_offer: number;
  session_status: string;
  tier_used: string;
  discount_percentage: number;
  badge_awarded?: string;
  below_floor_strikes: number;
}

function getFloorPrice(askingPrice: number, gameMode: string): number {
  if (gameMode === "easy") return askingPrice * 0.50;
  if (gameMode === "hard") return askingPrice * 0.70;
  if (gameMode === "savage_boss") return askingPrice * 0.85;
  return askingPrice * 0.70;
}

function determineTier(currentOffer: number, floorPrice: number, gameMode: string, message: string): string {
  if (gameMode === "savage_boss") return "TIER_2_REASONING";
  if ((currentOffer - floorPrice) / floorPrice <= 0.20) return "TIER_2_REASONING";
  if (message.trim().split(/\s+/).filter(Boolean).length > 12) return "TIER_2_REASONING";
  return "TIER_1_FAST";
}

async function generateVendorDialogue(p: {
  honorific: string; gameMode: string; stage: string; askingPrice: number;
  currentOffer: number; discountPct: number; patience: number;
  outcome: string; tier: string; fallback: string;
  vendorName: string; vendorGender: string; vendorAgeBand: string; vendorPersonality: string;
  marketName: string; itemName: string;
  weatherTempC?: number | null; weatherCondition?: string | null;
}): Promise<string> {
  if (!process.env.GEMINI_API_KEY) return p.fallback;
  const model = p.tier === "TIER_1_FAST" ? MODEL_FAST : MODEL_REASONING;
  const mood = p.patience >= 75 ? "cheerful and welcoming"
    : p.patience >= 40 ? "getting impatient" : "fed up and sharp-tongued";
  const weatherLine =
    typeof p.weatherTempC === "number" && p.weatherCondition
      ? `\nToday's weather here is ${p.weatherCondition}, ${Math.round(p.weatherTempC)}°C — if it fits naturally, grumble about the heat, complain about rain hurting sales, or mention it briefly. Don't force it into every line.`
      : "";
  const prompt = `You are ${p.vendorName}, a ${p.vendorAgeBand} ${p.vendorGender.toLowerCase()} vendor at ${p.marketName}, mid-haggle over a ${p.itemName} priced at ₹${Math.round(p.askingPrice)}.
Your personality: ${p.vendorPersonality}.
Address the shopper only as "${p.honorific}", never by any other name.
Speak in natural Hinglish (Hindi-English mix), playful and a little dramatic, never robotic.
Current mood: ${mood} (patience: ${p.patience}/100). Stage: ${p.stage}. Game mode: ${p.gameMode}.${weatherLine}
The shopper just offered ₹${Math.round(p.currentOffer)} (${p.discountPct.toFixed(0)}% off asking). Outcome: ${p.outcome}.
Write ONE short reaction (1-2 sentences max). Do not state any specific rupee counter-offer beyond what's given. Do not break character or mention being an AI.`;
  try {
    const response = await ai.models.generateContent({ model, contents: prompt });
    const text = response.text?.trim();
    return text || p.fallback;
  } catch (e) {
    console.error("Gemini call failed, using fallback:", e);
    return p.fallback;
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BargainRequestBody;
  const stage = body.stage ?? "The Pitch";
  const vendorPatience = body.vendor_patience ?? 100;
  const belowFloorStrikes = body.below_floor_strikes ?? 0;

  const floorPrice = getFloorPrice(body.asking_price, body.game_mode);
  const tier = determineTier(body.current_offer, floorPrice, body.game_mode, body.user_message);
  const honorific = body.user_profile.honorific;
  const discountOffered = ((body.asking_price - body.current_offer) / body.asking_price) * 100;

  const persona = {
    vendorName: body.vendor_persona.name,
    vendorGender: body.vendor_persona.gender,
    vendorAgeBand: body.vendor_persona.ageBand,
    vendorPersonality: body.vendor_persona.personality,
    marketName: body.market_name,
    itemName: body.item_name,
    weatherTempC: body.weather_temp_c ?? null,
    weatherCondition: body.weather_condition ?? null,
  };

  // HARD MODE — two-strike rule: first below-floor offer warns, second one bans
  if (body.game_mode === "hard" && body.current_offer < floorPrice) {
    if (belowFloorStrikes === 0) {
      const fallback = `Arey ${honorific}! Ye keemat toh bekaar hai, dobara aisi galti mat karna!`;
      const dialogue = await generateVendorDialogue({
        honorific, gameMode: body.game_mode, stage, askingPrice: body.asking_price,
        currentOffer: body.current_offer, discountPct: discountOffered, patience: vendorPatience,
        ...persona,
        outcome: "warning_below_floor", tier, fallback,
      });
      return NextResponse.json({
        vendor_dialogue: dialogue, emotional_state: stage,
        patience_remaining: Math.max(0, vendorPatience - 25),
        current_counter_offer: floorPrice, session_status: "ACTIVE",
        tier_used: tier, discount_percentage: discountOffered, below_floor_strikes: 1,
      } satisfies BargainResponseBody);
    }
    const fallback = `Arey ${honorific}! Itne daam me toh iski packing bhi nahi aati. Aage bado, aage shop pe dekho!`;
    const dialogue = await generateVendorDialogue({
      honorific, gameMode: body.game_mode, stage, askingPrice: body.asking_price,
      currentOffer: body.current_offer, discountPct: discountOffered, patience: vendorPatience,
      ...persona,
      outcome: "banned_hard", tier, fallback,
    });
    return NextResponse.json({
      vendor_dialogue: dialogue, emotional_state: "Expelled", patience_remaining: 0,
      current_counter_offer: body.asking_price, session_status: "DEAL_FAILED",
      tier_used: tier, discount_percentage: 0.0, badge_awarded: "🤡 Certified Bakra",
      below_floor_strikes: belowFloorStrikes,
    } satisfies BargainResponseBody);
  }

  // SAVAGE BOSS — instant ban, unchanged
  if (body.game_mode === "savage_boss" && discountOffered > 15.0) {
    const fallback = `Savage Boss says: 'Mera dhandha band karwaoge kya, ${honorific}? Out of my shop!'`;
    const dialogue = await generateVendorDialogue({
      honorific, gameMode: body.game_mode, stage, askingPrice: body.asking_price,
      currentOffer: body.current_offer, discountPct: discountOffered, patience: vendorPatience,
      ...persona,
      outcome: "banned_boss", tier, fallback,
    });
    return NextResponse.json({
      vendor_dialogue: dialogue, emotional_state: "Expelled", patience_remaining: 0,
      current_counter_offer: body.asking_price, session_status: "DEAL_FAILED",
      tier_used: tier, discount_percentage: 0.0, badge_awarded: "🤡 Kicked Out",
      below_floor_strikes: belowFloorStrikes,
    } satisfies BargainResponseBody);
  }

  // DEAL SUCCESS
  if (body.current_offer >= floorPrice && (stage === "The Squeeze" || stage === "Resolution")) {
    const savingsPct = ((body.asking_price - body.current_offer) / body.asking_price) * 100;
    let badge = "⚡ Smart Shopper";
    if (body.game_mode === "easy" && savingsPct >= 40) badge = "👑 Sarojini Legend";
    else if (body.game_mode === "savage_boss") badge = "👑 BOSS SLAYER";
    else if (savingsPct < 10) badge = "💸 Overpayer / Rookie";
    const fallback = `Arey ${honorific}, aap toh peeche hi pad gaye! Chalo, packing kardu? ₹${Math.round(body.current_offer)} me le jao.`;
    const dialogue = await generateVendorDialogue({
      honorific, gameMode: body.game_mode, stage, askingPrice: body.asking_price,
      currentOffer: body.current_offer, discountPct: savingsPct, patience: vendorPatience,
      ...persona,
      outcome: "success", tier, fallback,
    });
    return NextResponse.json({
      vendor_dialogue: dialogue, emotional_state: "Resolution", patience_remaining: vendorPatience,
      current_counter_offer: body.current_offer, session_status: "DEAL_SUCCESS",
      tier_used: tier, discount_percentage: savingsPct, badge_awarded: badge,
      below_floor_strikes: belowFloorStrikes,
    } satisfies BargainResponseBody);
  }

  // IN PROGRESS
  const newPatience = Math.max(0, vendorPatience - 25);
  let dialogueFallback: string, nextStage: string, counter: number;
  if (body.current_offer < body.asking_price * 0.4) {
    dialogueFallback = `Arey ${honorific}! ₹${Math.round(body.current_offer)}? Mera ghar neelam karwaoge kya? Sahi daam lagao!`;
    nextStage = "The Shock"; counter = body.asking_price * 0.85;
  } else {
    dialogueFallback = `Dekho ${honorific}, last price ₹${Math.round(body.asking_price * 0.75)} lagega. Utne me chahiye toh bolo.`;
    nextStage = "The Squeeze"; counter = body.asking_price * 0.75;
  }
  const dialogue = await generateVendorDialogue({
    honorific, gameMode: body.game_mode, stage, askingPrice: body.asking_price,
    currentOffer: body.current_offer, discountPct: discountOffered, patience: vendorPatience,
    ...persona,
    outcome: "active", tier, fallback: dialogueFallback,
  });
  return NextResponse.json({
    vendor_dialogue: dialogue, emotional_state: nextStage, patience_remaining: newPatience,
    current_counter_offer: counter, session_status: "ACTIVE",
    tier_used: tier, discount_percentage: discountOffered, below_floor_strikes: belowFloorStrikes,
  } satisfies BargainResponseBody);
}
