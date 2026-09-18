import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getAdminConfig, getSponsors, type Sponsor } from "@/lib/db";

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
  previous_vendor_offer?: number;
  weather_temp_c?: number | null;
  weather_condition?: string | null;
}

interface SponsorVoucher {
  sponsorName: string;
  discountPercent: number;
  code: string;
}

/**
 * Admin-controlled extras. Never allowed to break a turn: if the store is
 * unreachable the game falls back to no voucher and the stock Savage Boss ban.
 */
async function loadAdminExtras(): Promise<{ campaignActive: boolean; winRate: number; sponsors: Sponsor[] }> {
  try {
    const [config, sponsors] = await Promise.all([getAdminConfig(), getSponsors()]);
    return {
      campaignActive: config.campaignActive,
      winRate: config.savageBossWinRateOverride,
      sponsors: sponsors.filter((s) => s.active),
    };
  } catch (e) {
    console.error("Admin config/sponsor lookup failed; continuing without them:", e);
    return { campaignActive: false, winRate: 0, sponsors: [] };
  }
}

function issueVoucher(campaignActive: boolean, sponsors: Sponsor[]): SponsorVoucher | null {
  if (!campaignActive || sponsors.length === 0) return null;
  const sponsor = sponsors[Math.floor(Math.random() * sponsors.length)];
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  const prefix = sponsor.name.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase();
  return { sponsorName: sponsor.name, discountPercent: sponsor.discountPercent, code: `${prefix}${suffix}` };
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
  sponsor_voucher?: SponsorVoucher | null;
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

  const extras = await loadAdminExtras();

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

  // SAVAGE BOSS — an admin-tuned sliver of over-the-cap offers survive; the rest ban as before.
  if (body.game_mode === "savage_boss" && discountOffered > 15.0) {
    if (extras.winRate > 0 && Math.random() < extras.winRate) {
      const savingsPct = discountOffered;
      const fallback = `Arey ${honorific}... aaj mera mood acha hai. Le jao, ₹${Math.round(body.current_offer)} me. Kisi ko mat batana!`;
      const dialogue = await generateVendorDialogue({
        honorific, gameMode: body.game_mode, stage, askingPrice: body.asking_price,
        currentOffer: body.current_offer, discountPct: savingsPct, patience: vendorPatience,
        ...persona,
        outcome: "boss_slayer_upset", tier, fallback,
      });
      return NextResponse.json({
        vendor_dialogue: dialogue, emotional_state: "Resolution", patience_remaining: vendorPatience,
        current_counter_offer: body.current_offer, session_status: "DEAL_SUCCESS",
        tier_used: tier, discount_percentage: savingsPct, badge_awarded: "👑 BOSS SLAYER",
        below_floor_strikes: belowFloorStrikes,
        sponsor_voucher: issueVoucher(extras.campaignActive, extras.sponsors),
      } satisfies BargainResponseBody);
    }
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
      sponsor_voucher: issueVoucher(extras.campaignActive, extras.sponsors),
    } satisfies BargainResponseBody);
  }

  // LUCKY BREAK — Easy Mode only. A modest below-floor offer sometimes lands.
  // Hard Mode and Savage Boss are untouched: they already returned above.
  if (
    body.game_mode === "easy" &&
    body.current_offer >= floorPrice * 0.85 &&
    body.current_offer < floorPrice &&
    Math.random() < 0.2
  ) {
    const savingsPct = ((body.asking_price - body.current_offer) / body.asking_price) * 100;
    const fallback = `Arey ${honorific}, aaj dhandha manda hai... chalo le jao ₹${Math.round(body.current_offer)} me, kisi ko batana mat!`;
    const dialogue = await generateVendorDialogue({
      honorific, gameMode: body.game_mode, stage, askingPrice: body.asking_price,
      currentOffer: body.current_offer, discountPct: savingsPct, patience: vendorPatience,
      ...persona,
      outcome: "lucky_break", tier, fallback,
    });
    return NextResponse.json({
      vendor_dialogue: dialogue, emotional_state: "Resolution", patience_remaining: vendorPatience,
      current_counter_offer: body.current_offer, session_status: "DEAL_SUCCESS",
      tier_used: tier, discount_percentage: savingsPct, badge_awarded: "🍀 Lucky Break",
      below_floor_strikes: belowFloorStrikes,
      sponsor_voucher: issueVoucher(extras.campaignActive, extras.sponsors),
    } satisfies BargainResponseBody);
  }

  // IN PROGRESS — the vendor converges toward the floor from its own last offer,
  // so repeated offers in the same range no longer produce an identical counter.
  const newPatience = Math.max(0, vendorPatience - 25);
  const previousVendorOffer = body.previous_vendor_offer ?? body.asking_price;
  const isDeepLowball = body.current_offer < body.asking_price * 0.4;
  const nextStage = isDeepLowball ? "The Shock" : "The Squeeze";
  const concessionRate = isDeepLowball ? 0.15 : 0.35;
  const gap = Math.max(0, previousVendorOffer - floorPrice);
  let counter = Math.max(floorPrice, previousVendorOffer - gap * concessionRate);
  counter = Math.round(counter / 10) * 10;

  const dialogueFallback = isDeepLowball
    ? `Arey ${honorific}! ₹${Math.round(body.current_offer)}? Mera ghar neelam karwaoge kya? ₹${counter} se ek rupya kam nahi!`
    : `Dekho ${honorific}, last price ₹${counter} lagega. Utne me chahiye toh bolo.`;
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
