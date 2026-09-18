"use client";

import { useState, useRef, useEffect, useCallback, useSyncExternalStore } from "react";
import { MARKETS, CITY_TO_MARKET, type Market, type MarketItem, type VendorPersona } from "@/lib/markets";
import { renderShareCard, shareMessage, whatsappUrl } from "@/lib/shareCard";

const API_URL = "/api/bargain";

type GameMode = "easy" | "hard" | "savage_boss";
type Gender = "Male" | "Female" | "Other";

interface UserProfile {
  name: string;
  age: number;
  gender: Gender;
  honorific: string;
}

interface BargainResponse {
  vendor_dialogue: string;
  emotional_state: string;
  patience_remaining: number;
  current_counter_offer: number;
  session_status: "ACTIVE" | "DEAL_SUCCESS" | "DEAL_FAILED";
  tier_used: string;
  discount_percentage: number;
  badge_awarded?: string | null;
  below_floor_strikes: number;
  sponsor_voucher?: { sponsorName: string; discountPercent: number; code: string } | null;
}

interface Message {
  role: "user" | "vendor";
  content: string;
  tier?: string;
}

interface Weather {
  marketId: string | null;
  temperatureC: number | null;
  condition: string | null;
}

const NO_WEATHER: Weather = { marketId: null, temperatureC: null, condition: null };

interface ModeDef {
  value: GameMode;
  emoji: string;
  label: string;
  note: string;
  color: string;
  heat: number;
}

const MODES: ModeDef[] = [
  { value: "easy", emoji: "🟢", label: "Easy Mode", note: "up to 50% off", color: "var(--green)", heat: 1 },
  { value: "hard", emoji: "🔴", label: "Hard Mode", note: "strict 30% cap", color: "var(--pink)", heat: 2 },
  { value: "savage_boss", emoji: "🔥", label: "Weekly Savage Boss", note: "15% floor", color: "var(--violet)", heat: 3 },
];

const STAGES = ["The Pitch", "The Shock", "The Squeeze", "Resolution"];

function computeHonorific(age: number, gender: Gender): string {
  if (age < 18) return "Beta";
  if (gender === "Female") return age < 45 ? "Didi" : "Mata ji";
  if (gender === "Other") return age < 45 ? "Dost" : "Saathi ji";
  return age < 45 ? "Bhaiya" : "Uncle ji";
}

function modeOf(mode: GameMode): ModeDef {
  return MODES.find((m) => m.value === mode) as ModeDef;
}

function startingOffer(askingPrice: number): number {
  return Math.max(50, Math.round((askingPrice * 0.5) / 50) * 50);
}

export default function Home() {
  const [started, setStarted] = useState(false);

  const [market, setMarket] = useState<Market | null>(null);
  const [item, setItem] = useState<MarketItem | null>(null);
  const [vendor, setVendor] = useState<VendorPersona | null>(null);
  const [suggestedMarketId, setSuggestedMarketId] = useState<string | null>(null);
  const [weather, setWeather] = useState<Weather>(NO_WEATHER);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);

  const [name, setName] = useState("Rahul");
  const [age, setAge] = useState(25);
  const [gender, setGender] = useState<Gender>("Male");
  const [gameMode, setGameMode] = useState<GameMode>("easy");

  const [messages, setMessages] = useState<Message[]>([]);
  const [stage, setStage] = useState("The Pitch");
  const [patience, setPatience] = useState(100);
  const [belowFloorStrikes, setBelowFloorStrikes] = useState(0);
  const [previousVendorOffer, setPreviousVendorOffer] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState<BargainResponse | null>(null);

  const [offer, setOffer] = useState(1000);
  const [userMessage, setUserMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryPayload, setRetryPayload] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const honorific = computeHonorific(age, gender);
  const mode = modeOf(gameMode);
  const activeWeather = market && weather.marketId === market.id ? weather : NO_WEATHER;

  // City-level suggestion. Stays silent on any failure — the picker just shows no hint.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { city?: string | null } | null) => {
        if (cancelled || typeof d?.city !== "string") return;
        const id = CITY_TO_MARKET[d.city.trim().toLowerCase()];
        if (id) setSuggestedMarketId(id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Flavor only: a failed lookup just means no weather line anywhere. Results are
  // tagged with the market they belong to so a slow reply can't leak into another one.
  useEffect(() => {
    if (!market) return;
    const id = market.id;
    let cancelled = false;
    fetch(`/api/weather?lat=${market.lat}&lon=${market.lon}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Partial<Weather> | null) => {
        if (cancelled) return;
        setWeather({
          marketId: id,
          temperatureC: typeof d?.temperatureC === "number" ? d.temperatureC : null,
          condition: typeof d?.condition === "string" ? d.condition : null,
        });
      })
      .catch(() => {
        if (!cancelled) setWeather({ ...NO_WEATHER, marketId: id });
      });
    return () => {
      cancelled = true;
    };
  }, [market]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function chooseMarket(m: Market) {
    setMarket(m);
    setItem(null);
    setVendor(null);
  }

  function chooseItem(m: Market, it: MarketItem) {
    setItem(it);
    setVendor(m.vendors[Math.floor(Math.random() * m.vendors.length)]);
  }

  function startGame() {
    if (!item) return;
    setOffer(startingOffer(item.askingPrice));
    setMessages([]);
    setStage("The Pitch");
    setPatience(100);
    setBelowFloorStrikes(0);
    setPreviousVendorOffer(null);
    setGameOver(false);
    setResult(null);
    setUserMessage("");
    setError(null);
    setStarted(true);
  }

  // Back to the picker with the item cleared, so a replay re-rolls the vendor.
  function backToPicker() {
    setStarted(false);
    setItem(null);
    setVendor(null);
    setMessages([]);
    setStage("The Pitch");
    setPatience(100);
    setBelowFloorStrikes(0);
    setPreviousVendorOffer(null);
    setGameOver(false);
    setResult(null);
    setUserMessage("");
    setError(null);
  }

  // A failed turn never mutates game state, so retrying the identical payload is safe.
  async function sendTurn(payload: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });

      if (!res.ok) throw new Error(`Server responded ${res.status}`);

      const data: BargainResponse = await res.json();

      setStage(data.emotional_state);
      setPatience(data.patience_remaining);
      setBelowFloorStrikes(data.below_floor_strikes);
      setPreviousVendorOffer(data.current_counter_offer);
      setMessages((prev) => [
        ...prev,
        { role: "vendor", content: data.vendor_dialogue, tier: data.tier_used },
      ]);

      if (data.session_status === "DEAL_SUCCESS" || data.session_status === "DEAL_FAILED") {
        setGameOver(true);
        setResult(data);
      } else {
        setOffer(Math.round(data.current_counter_offer));
      }
      setRetryPayload(null);
    } catch {
      setError("Something went wrong — try again.");
      setRetryPayload(payload);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!userMessage.trim() || loading || gameOver || !market || !item || !vendor) return;

    const outgoing = userMessage.trim();
    setMessages((prev) => [...prev, { role: "user", content: outgoing }]);
    setUserMessage("");

    const profile: UserProfile = { name, age, gender, honorific };

    await sendTurn(
      JSON.stringify({
        game_mode: gameMode,
        asking_price: item.askingPrice,
        current_offer: offer,
        user_message: outgoing,
        user_profile: profile,
        vendor_persona: {
          name: vendor.name,
          gender: vendor.gender,
          ageBand: vendor.ageBand,
          personality: vendor.personality,
        },
        market_name: market.name,
        item_name: item.name,
        stage,
        vendor_patience: patience,
        below_floor_strikes: belowFloorStrikes,
        previous_vendor_offer: previousVendorOffer ?? item.askingPrice,
        weather_temp_c: activeWeather.temperatureC,
        weather_condition: activeWeather.condition,
      })
    );
  }

  if (!started || !market || !item || !vendor) {
    return (
      <SetupScreen
        market={market}
        item={item}
        vendor={vendor}
        suggestedMarketId={suggestedMarketId}
        chooseMarket={chooseMarket}
        chooseItem={chooseItem}
        weather={activeWeather}
        avatarDataUrl={avatarDataUrl}
        setAvatarDataUrl={setAvatarDataUrl}
        name={name}
        setName={setName}
        age={age}
        setAge={setAge}
        gender={gender}
        setGender={setGender}
        gameMode={gameMode}
        setGameMode={setGameMode}
        honorific={honorific}
        onStart={startGame}
      />
    );
  }

  const askingPrice = item.askingPrice;
  const offerDiscount = Math.round(((askingPrice - offer) / askingPrice) * 100);

  return (
    <main className="h-screen flex flex-col overflow-hidden">
      <div className="grain" />

      {/* Top bar */}
      <header className="shrink-0 border-b-2 border-[var(--ink)] bg-[var(--paper)] px-5 md:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-display font-extrabold text-lg tracking-[-0.03em] truncate">
            {market.name}
          </span>
          <span
            className="label px-2 py-1 text-[var(--paper)] font-bold shrink-0"
            style={{ background: mode.color }}
          >
            {mode.label}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <span className="label text-[var(--ink-60)]">Patience</span>
          <PatienceMeter patience={patience} />
          <span className="font-mono text-xs font-bold w-8">{patience}</span>
        </div>

        <button
          onClick={backToPicker}
          className="label border-2 border-[var(--ink)] px-3 py-1.5 bg-[var(--paper)] hard-shadow-sm press font-bold shrink-0"
        >
          Reset
        </button>
      </header>

      {/* Compact status strip (small screens, where the rail is hidden) */}
      <div className="lg:hidden shrink-0 border-b-2 border-[var(--ink)] bg-[var(--cream)] px-5 py-2.5 flex items-center justify-between gap-4">
        <span className="label text-[var(--ink-40)]">
          Asking <span className="text-[var(--marigold)] font-bold">₹{askingPrice}</span>
        </span>
        <span className="label font-bold">{stage}</span>
        <PatienceMeter patience={patience} />
      </div>

      <div className="flex-1 grid lg:grid-cols-[360px_1fr] min-h-0">
        {/* Left rail */}
        <aside className="hidden lg:flex flex-col gap-6 border-r-2 border-[var(--ink)] bg-[var(--cream)] p-7 overflow-y-auto">
          <div>
            <p className="label text-[var(--ink-40)] mb-2">The Buyer</p>
            <p className="font-display text-3xl font-extrabold tracking-[-0.03em] leading-none">
              {name}
            </p>
            <p className="mt-2 text-sm text-[var(--ink-60)]">
              addressed as{" "}
              <span className="font-serif italic text-xl bg-[var(--marigold)] px-1.5 text-[var(--paper)] not-italic">
                {honorific}
              </span>
            </p>
          </div>

          <VendorCard vendor={vendor} />

          <PriceTag itemName={item.name} place={`${market.name} · ${market.city}`} price={askingPrice} />

          <div>
            <p className="label text-[var(--ink-40)] mb-3">Stage</p>
            <StageTrack stage={stage} />
          </div>

          <div className="mt-auto pt-6 border-t-2 border-dashed border-[var(--ink-18)]">
            <p className="label text-[var(--ink-40)] leading-relaxed">
              Engine
              <br />
              <span className="text-[var(--ink)]">POST /api/bargain · Gemini</span>
            </p>
          </div>
        </aside>

        {/* Chat / result column */}
        <section className="flex flex-col min-h-0 bg-[var(--paper)]">
          {gameOver && result ? (
            <ResultTakeover
              name={name}
              result={result}
              itemName={item.name}
              askingPrice={askingPrice}
              marketName={market.name}
              city={market.city}
              vendorName={vendor.name}
              avatarDataUrl={avatarDataUrl}
              onPlayAgain={backToPicker}
            />
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 md:px-10 py-8">
                {messages.length === 0 && (
                  <EmptyState honorific={honorific} itemName={item.name} vendor={vendor} />
                )}

                <div className="space-y-7 max-w-3xl">
                  {messages.map((m, i) =>
                    m.role === "user" ? (
                      <UserBubble key={i} content={m.content} avatarDataUrl={avatarDataUrl} />
                    ) : (
                      <VendorBubble key={i} content={m.content} tier={m.tier} vendorName={vendor.name} />
                    )
                  )}
                  {loading && <Thinking vendorName={vendor.name} />}
                </div>
              </div>

              {error && (
                <div className="shrink-0 border-t-2 border-[var(--ink)] bg-[var(--pink)] text-[var(--paper)] px-5 md:px-10 py-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="font-mono text-xs leading-relaxed">{error}</p>
                  {retryPayload && (
                    <button
                      type="button"
                      onClick={() => sendTurn(retryPayload)}
                      disabled={loading}
                      className="label font-bold border-2 border-[var(--paper)] px-4 py-2 min-h-[40px] disabled:opacity-50"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}

              {/* Composer */}
              <form
                onSubmit={handleSubmit}
                className="shrink-0 border-t-2 border-[var(--ink)] bg-[var(--cream)] px-5 md:px-10 py-5"
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-5">
                  <p className="label text-[var(--ink-40)] shrink-0">Your Offer</p>
                  <div className="flex items-center gap-2">
                    <StepButton
                      onClick={() => setOffer((o) => Math.max(50, o - 50))}
                      label="−"
                      disabled={loading}
                    />
                    <div className="flex items-baseline border-b-2 border-[var(--ink)] px-1">
                      <span className="font-display text-2xl font-extrabold">₹</span>
                      <input
                        type="number"
                        min={50}
                        max={askingPrice}
                        step={50}
                        value={offer}
                        onChange={(e) => setOffer(Number(e.target.value))}
                        disabled={loading}
                        className="w-[4.5ch] bg-transparent font-display text-[38px] font-extrabold tracking-[-0.04em] leading-none text-center"
                      />
                    </div>
                    <StepButton
                      onClick={() => setOffer((o) => Math.min(askingPrice, o + 50))}
                      label="+"
                      disabled={loading}
                    />
                  </div>
                  <p className="label text-[var(--ink-60)]">
                    <span className="text-[var(--marigold)] font-bold">{offerDiscount}%</span> below
                    asking
                  </p>
                </div>

                <div className="flex items-end gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="label text-[var(--ink-40)] mb-1.5">Say something</p>
                    <input
                      type="text"
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSubmit(e);
                      }}
                      placeholder={`${vendor.name}, itna mehnga kyun?`}
                      disabled={loading}
                      className="w-full bg-transparent border-b-2 border-[var(--ink)] pb-2 font-serif text-xl placeholder:text-[var(--ink-40)] placeholder:font-sans placeholder:text-base"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !userMessage.trim()}
                    className="label font-bold border-2 border-[var(--ink)] bg-[var(--marigold)] text-[var(--paper)] px-6 py-3 hard-shadow press disabled:opacity-30 disabled:pointer-events-none shrink-0"
                  >
                    Send →
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

/* ---------------- Setup / picker ---------------- */

function SetupScreen(props: {
  market: Market | null;
  item: MarketItem | null;
  vendor: VendorPersona | null;
  suggestedMarketId: string | null;
  chooseMarket: (m: Market) => void;
  chooseItem: (m: Market, it: MarketItem) => void;
  weather: Weather;
  avatarDataUrl: string | null;
  setAvatarDataUrl: (v: string | null) => void;
  name: string;
  setName: (v: string) => void;
  age: number;
  setAge: (v: number) => void;
  gender: Gender;
  setGender: (v: Gender) => void;
  gameMode: GameMode;
  setGameMode: (v: GameMode) => void;
  honorific: string;
  onStart: () => void;
}) {
  const {
    market, item, vendor, suggestedMarketId, chooseMarket, chooseItem,
    weather, avatarDataUrl, setAvatarDataUrl,
    name, setName, age, setAge, gender, setGender, gameMode, setGameMode, honorific, onStart,
  } = props;

  const ready = Boolean(market && item && vendor);

  return (
    <main className="min-h-screen flex flex-col">
      <div className="grain" />

      <div className="border-y-2 border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] overflow-hidden py-2">
        <div className="marquee-track">
          {[0, 1].map((k) => (
            <span key={k} className="label flex shrink-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className="px-5">
                  No fixed price <span className="text-[var(--marigold)]">✷</span> Bargain or bust{" "}
                  <span className="text-[var(--marigold)]">✷</span> Three cities, six stalls{" "}
                  <span className="text-[var(--marigold)]">✷</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 max-w-6xl w-full mx-auto px-6 md:px-10 py-12 md:py-16">
        {/* Hero */}
        <div className="grid md:grid-cols-[1fr_auto] gap-10 items-start mb-16">
          <div>
            <p className="label text-[var(--ink-40)] mb-5">The Bargaining Engine · Live Demo</p>
            <h1 className="font-display font-extrabold tracking-[-0.05em] leading-[0.84] text-[clamp(56px,9.5vw,132px)]">
              MRP IS A
              <br />
              <span className="font-serif italic font-normal tracking-[-0.02em] relative inline-block">
                suggestion
                <Squiggle />
              </span>
              <span className="text-[var(--marigold)]">.</span>
            </h1>
            <p className="mt-8 max-w-md text-[var(--ink-60)] leading-relaxed">
              Pick a market, pick something you want, and talk the vendor down before their patience
              runs out.
            </p>
          </div>

          {market && item && (
            <div className="justify-self-start md:justify-self-end">
              <PriceTag
                itemName={item.name}
                place={`${market.name} · ${market.city}`}
                price={item.askingPrice}
                rotate
              />
            </div>
          )}
        </div>

        {/* 01 — Markets */}
        <section className="mb-14">
          <SectionHead num="01" title="Pick your market" />
          <div className="grid sm:grid-cols-3 gap-4">
            {MARKETS.map((m) => {
              const active = market?.id === m.id;
              const suggested = suggestedMarketId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => chooseMarket(m)}
                  className={`relative text-left border-2 border-[var(--ink)] p-5 press ${
                    active
                      ? "bg-[var(--ink)] text-[var(--paper)] hard-shadow"
                      : "bg-[var(--paper)] hard-shadow-sm"
                  }`}
                >
                  {suggested && (
                    <span className="absolute -top-3 left-4 label font-bold bg-[var(--marigold)] text-[var(--paper)] px-2 py-0.5 border-2 border-[var(--ink)]">
                      Near you
                    </span>
                  )}
                  <p
                    className={`label mb-2 ${active ? "opacity-70" : "text-[var(--ink-40)]"}`}
                  >
                    {m.city}
                  </p>
                  <p className="font-display font-extrabold text-xl tracking-[-0.03em] leading-tight">
                    {m.name}
                  </p>
                  <p className={`mt-3 text-sm ${active ? "opacity-70" : "text-[var(--ink-60)]"}`}>
                    {m.items.length} items · {m.vendors.length} vendors
                  </p>
                </button>
              );
            })}
          </div>

          {market && weather.temperatureC !== null && weather.condition && (
            <p className="mt-4 label text-[var(--ink-60)]">
              {market.city} right now:{" "}
              <span className="text-[var(--marigold)] font-bold">
                {Math.round(weather.temperatureC)}°C, {weather.condition}
              </span>
            </p>
          )}
        </section>

        {/* 02 — Items */}
        <section className="mb-14">
          <SectionHead num="02" title="Pick your item" />
          {!market ? (
            <p className="border-2 border-dashed border-[var(--ink-18)] p-5 text-[var(--ink-40)] font-serif italic text-xl">
              Choose a market first.
            </p>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                {market.items.map((it) => {
                  const active = item?.id === it.id;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => chooseItem(market, it)}
                      className={`flex items-center justify-between gap-4 text-left border-2 border-[var(--ink)] p-5 press ${
                        active
                          ? "bg-[var(--marigold)] text-[var(--paper)] hard-shadow"
                          : "bg-[var(--paper)] hard-shadow-sm"
                      }`}
                    >
                      <span className="font-display font-extrabold text-xl tracking-[-0.03em] leading-tight">
                        {it.name}
                      </span>
                      <span className="font-display font-extrabold text-2xl tracking-[-0.04em] shrink-0">
                        ₹{it.askingPrice}
                      </span>
                    </button>
                  );
                })}
              </div>

              {vendor && (
                <div className="mt-5 border-2 border-[var(--ink)] bg-[var(--paper)] hard-shadow-sm p-5">
                  <p className="label text-[var(--ink-40)] mb-2">You&apos;ll be haggling with</p>
                  <p className="font-display font-extrabold text-2xl tracking-[-0.03em]">
                    {vendor.name}
                  </p>
                  <p className="font-serif italic text-lg text-[var(--ink-60)] mt-1">
                    {vendor.ageBand} · {vendor.personality}
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        {/* 03 / 04 */}
        <div className="grid md:grid-cols-2 gap-x-14 gap-y-12">
          <section>
            <SectionHead num="03" title="Who's buying?" />

            <div className="space-y-7">
              <div className="grid grid-cols-[1fr_110px] gap-5">
                <Field label="Name">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-transparent border-b-2 border-[var(--ink)] pb-2 font-display text-3xl font-extrabold tracking-[-0.03em]"
                  />
                </Field>
                <Field label="Age">
                  <input
                    type="number"
                    min={10}
                    max={80}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full bg-transparent border-b-2 border-[var(--ink)] pb-2 font-display text-3xl font-extrabold tracking-[-0.03em]"
                  />
                </Field>
              </div>

              <Field label="Gender">
                <div className="flex gap-2">
                  {(["Male", "Female", "Other"] as Gender[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`flex-1 border-2 border-[var(--ink)] py-2.5 text-sm font-bold press ${
                        gender === g
                          ? "bg-[var(--ink)] text-[var(--paper)] hard-shadow-sm"
                          : "bg-[var(--paper)]"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </Field>

              <AvatarPicker avatarDataUrl={avatarDataUrl} setAvatarDataUrl={setAvatarDataUrl} />

              <div className="border-2 border-dashed border-[var(--ink-18)] p-4">
                <p className="label text-[var(--ink-40)] mb-2">The vendor will call you</p>
                <p className="font-serif italic text-4xl leading-none">
                  <span className="bg-[var(--marigold)] text-[var(--paper)] px-2 not-italic font-display font-extrabold tracking-[-0.03em]">
                    {honorific}
                  </span>
                </p>
              </div>
            </div>
          </section>

          <section>
            <SectionHead num="04" title="Pick your battle" />

            <div className="space-y-3">
              {MODES.map((m) => {
                const active = gameMode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setGameMode(m.value)}
                    className={`w-full text-left border-2 border-[var(--ink)] p-4 press ${
                      active ? "hard-shadow text-[var(--paper)]" : "bg-[var(--paper)]"
                    }`}
                    style={active ? { background: m.color } : undefined}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-display font-extrabold text-xl tracking-[-0.02em]">
                        {m.emoji} {m.label}
                      </span>
                      <span className="flex gap-1">
                        {[1, 2, 3].map((d) => (
                          <span
                            key={d}
                            className="w-2.5 h-2.5 border-2 border-current"
                            style={{ background: d <= m.heat ? "currentColor" : "transparent" }}
                          />
                        ))}
                      </span>
                    </div>
                    <p className={`label mt-2 ${active ? "opacity-80" : "text-[var(--ink-40)]"}`}>
                      {m.note}
                    </p>
                  </button>
                );
              })}
            </div>

            <button
              onClick={onStart}
              disabled={!ready}
              className="mt-8 w-full border-2 border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] py-5 hard-shadow press flex items-center justify-center gap-3 disabled:opacity-30 disabled:pointer-events-none"
            >
              <span className="font-display font-extrabold text-xl tracking-[-0.02em]">
                Start Haggling
              </span>
              <span className="text-[var(--marigold)] text-xl">→</span>
            </button>
            <p className="label text-[var(--ink-40)] mt-3 text-center">
              {ready ? "Next.js route handler · Gemini" : "Pick a market and an item first"}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

/* ---------------- Pieces ---------------- */

function SectionHead({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-7 pb-3 border-b-2 border-[var(--ink)]">
      <span className="font-mono text-xs font-bold text-[var(--marigold)]">{num}</span>
      <h2 className="font-display font-extrabold text-2xl tracking-[-0.03em]">{title}</h2>
    </div>
  );
}

function Avatar({ src, size = 34 }: { src: string | null; size?: number }) {
  const style = { width: size, height: size };
  if (!src) {
    return (
      <span
        style={style}
        className="shrink-0 rounded-full border-2 border-[var(--ink)] bg-[var(--cream)] flex items-center justify-center"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="var(--ink-40)">
          <circle cx="12" cy="8.5" r="4" />
          <path d="M3.5 21c0-4.4 3.8-7.5 8.5-7.5s8.5 3.1 8.5 7.5z" />
        </svg>
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Your avatar"
      style={style}
      className="shrink-0 rounded-full border-2 border-[var(--ink)] object-cover bg-[var(--cream)]"
    />
  );
}

function AvatarPicker({
  avatarDataUrl,
  setAvatarDataUrl,
}: {
  avatarDataUrl: string | null;
  setAvatarDataUrl: (v: string | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  async function startCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera not available — you can upload a photo instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setCameraOn(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError("Camera not available — you can upload a photo instead.");
      stopCamera();
    }
  }

  function capture() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth || 320;
    c.height = v.videoHeight || 240;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    setAvatarDataUrl(c.toDataURL("image/png"));
    stopCamera();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setAvatarDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div>
      <p className="label text-[var(--ink-40)] mb-2">Your face (optional)</p>

      <div className="border-2 border-[var(--ink)] bg-[var(--paper)] p-4">
        <div className="flex items-center gap-4">
          <Avatar src={avatarDataUrl} size={56} />
          <div className="flex flex-wrap gap-2">
            {!cameraOn && (
              <button
                type="button"
                onClick={startCamera}
                className="label font-bold border-2 border-[var(--ink)] bg-[var(--paper)] px-3 py-2 hard-shadow-sm press"
              >
                📷 {avatarDataUrl ? "Retake" : "Take a selfie"}
              </button>
            )}
            <label className="label font-bold border-2 border-[var(--ink)] bg-[var(--paper)] px-3 py-2 hard-shadow-sm press cursor-pointer">
              {avatarDataUrl ? "Change photo" : "Upload a photo"}
              <input type="file" accept="image/*" onChange={onFile} className="hidden" />
            </label>
            {avatarDataUrl && (
              <button
                type="button"
                onClick={() => setAvatarDataUrl(null)}
                className="label font-bold border-2 border-[var(--ink-18)] px-3 py-2 text-[var(--ink-40)] press"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <div className={cameraOn ? "mt-4" : "hidden"}>
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full max-w-[260px] border-2 border-[var(--ink)] bg-[var(--ink)]"
          />
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={capture}
              className="label font-bold border-2 border-[var(--ink)] bg-[var(--marigold)] text-[var(--paper)] px-4 py-2 hard-shadow-sm press"
            >
              Capture
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="label font-bold border-2 border-[var(--ink-18)] px-3 py-2 text-[var(--ink-40)] press"
            >
              Cancel
            </button>
          </div>
        </div>

        {cameraError && <p className="label text-[var(--pink)] mt-3">{cameraError}</p>}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label text-[var(--ink-40)] mb-2">{label}</p>
      {children}
    </div>
  );
}

function Squiggle() {
  return (
    <svg
      className="absolute left-0 w-full pointer-events-none"
      style={{ bottom: "-0.3em" }}
      height="14"
      viewBox="0 0 200 14"
      preserveAspectRatio="none"
      fill="none"
    >
      <path
        d="M2 9C28 3 40 11 66 7s38-8 64-3 46 9 68 4"
        stroke="var(--marigold)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PriceTag({
  itemName,
  place,
  price,
  rotate = false,
}: {
  itemName: string;
  place: string;
  price: number;
  rotate?: boolean;
}) {
  return (
    <div
      className={`relative border-2 border-[var(--ink)] bg-[var(--paper)] hard-shadow px-6 py-5 w-[240px] ${
        rotate ? "rotate-[-3deg]" : ""
      }`}
    >
      <span className="absolute top-4 right-4 w-3.5 h-3.5 rounded-full border-2 border-[var(--ink)] bg-[var(--cream)]" />
      <p className="label text-[var(--ink-40)]">On the rack</p>
      <p className="font-display font-extrabold text-2xl tracking-[-0.03em] leading-tight mt-1 pr-6">
        {itemName}
      </p>
      <p className="font-serif italic text-base text-[var(--ink-60)]">{place}</p>
      <div className="mt-4 pt-3 border-t-2 border-dashed border-[var(--ink-18)] flex items-baseline justify-between">
        <span className="label text-[var(--ink-40)]">Asking</span>
        <span className="font-display font-extrabold text-4xl tracking-[-0.04em] text-[var(--marigold)]">
          ₹{price}
        </span>
      </div>
    </div>
  );
}

function VendorCard({ vendor }: { vendor: VendorPersona }) {
  return (
    <div>
      <p className="label text-[var(--ink-40)] mb-2">The Vendor</p>
      <p className="font-display text-2xl font-extrabold tracking-[-0.03em] leading-none">
        {vendor.name}
      </p>
      <p className="font-serif italic text-base text-[var(--ink-60)] mt-1.5 leading-snug">
        {vendor.ageBand} · {vendor.personality}
      </p>
    </div>
  );
}

function PatienceMeter({ patience }: { patience: number }) {
  const filled = Math.round(patience / 25);
  const color = patience > 50 ? "var(--green)" : patience > 25 ? "var(--marigold)" : "var(--pink)";
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-7 h-3 border-2 border-[var(--ink)] transition-colors duration-300"
          style={{ background: i <= filled ? color : "transparent" }}
        />
      ))}
    </div>
  );
}

function StageTrack({ stage }: { stage: string }) {
  const expelled = stage === "Expelled";
  const activeIdx = STAGES.indexOf(stage);
  return (
    <ol className="space-y-1.5">
      {STAGES.map((s, i) => {
        const active = s === stage;
        const past = activeIdx > -1 && i < activeIdx;
        return (
          <li key={s} className="flex items-center gap-3">
            <span
              className={`w-2.5 h-2.5 border-2 border-[var(--ink)] ${
                active ? "bg-[var(--marigold)]" : past ? "bg-[var(--ink)]" : "bg-transparent"
              }`}
            />
            <span
              className={
                active
                  ? "font-display font-extrabold text-lg tracking-[-0.02em]"
                  : "text-sm text-[var(--ink-40)]"
              }
            >
              {s}
            </span>
          </li>
        );
      })}
      {expelled && (
        <li className="flex items-center gap-3 pt-1">
          <span className="w-2.5 h-2.5 border-2 border-[var(--ink)] bg-[var(--pink)]" />
          <span className="font-display font-extrabold text-lg tracking-[-0.02em] text-[var(--pink)]">
            Expelled
          </span>
        </li>
      )}
    </ol>
  );
}

function EmptyState({
  honorific,
  itemName,
  vendor,
}: {
  honorific: string;
  itemName: string;
  vendor: VendorPersona;
}) {
  return (
    <div className="max-w-md border-2 border-dashed border-[var(--ink-18)] p-6">
      <p className="label text-[var(--ink-40)] mb-3">Round 01</p>
      <p className="font-serif italic text-3xl leading-tight">
        {vendor.name} watches you eye the {itemName.toLowerCase()}, {honorific}.
      </p>
      <p className="mt-3 text-sm text-[var(--ink-60)]">
        Set your number, then say something. Lowball too hard and you&apos;re out on the street.
      </p>
    </div>
  );
}

function UserBubble({
  content,
  avatarDataUrl,
}: {
  content: string;
  avatarDataUrl: string | null;
}) {
  return (
    <div className="pop-in flex justify-end items-end gap-2.5">
      <div className="max-w-[78%]">
        <p className="label text-[var(--ink-40)] mb-1.5 text-right">You</p>
        <div className="border-2 border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] px-5 py-3.5 hard-shadow-sm">
          <p className="text-[15px] leading-relaxed">{content}</p>
        </div>
      </div>
      <Avatar src={avatarDataUrl} />
    </div>
  );
}

function VendorBubble({
  content,
  tier,
  vendorName,
}: {
  content: string;
  tier?: string;
  vendorName: string;
}) {
  const tier2 = tier === "TIER_2_REASONING";
  return (
    <div className="pop-in max-w-[85%]">
      <div className="relative border-2 border-[var(--ink)] bg-[var(--paper)] hard-shadow">
        <span className="absolute -top-[13px] left-4 label font-bold bg-[var(--ink)] text-[var(--paper)] px-2 py-0.5">
          {vendorName}
        </span>
        <p className="font-serif text-[22px] leading-snug px-5 pt-6 pb-4">{content}</p>
      </div>
      {tier && (
        <p className="label mt-2 flex items-center gap-1.5 text-[var(--ink-40)]">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: tier2 ? "var(--violet)" : "var(--ink-40)" }}
          />
          {tier}
        </p>
      )}
    </div>
  );
}

function Thinking({ vendorName }: { vendorName: string }) {
  return (
    <div className="pop-in max-w-[85%]" aria-live="polite">
      <div className="relative inline-flex items-center gap-2 border-2 border-[var(--ink)] bg-[var(--paper)] hard-shadow px-5 pt-5 pb-3.5">
        <span className="absolute -top-[13px] left-4 label font-bold bg-[var(--ink)] text-[var(--paper)] px-2 py-0.5">
          {vendorName}
        </span>
        <span className="label text-[var(--ink-40)]">is typing</span>
        <span className="flex items-center gap-1">
          {["dot-1", "dot-2", "dot-3"].map((d) => (
            <span key={d} className={`${d} w-2 h-2 rounded-full bg-[var(--marigold)]`} />
          ))}
        </span>
      </div>
    </div>
  );
}

function StepButton({
  onClick,
  label,
  disabled = false,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-11 h-11 sm:w-9 sm:h-9 border-2 border-[var(--ink)] bg-[var(--paper)] font-display font-extrabold text-xl leading-none press hard-shadow-sm disabled:opacity-40 disabled:pointer-events-none"
    >
      {label}
    </button>
  );
}

/* ---------------- Result ---------------- */

function ResultTakeover({
  name,
  result,
  itemName,
  askingPrice,
  marketName,
  city,
  vendorName,
  avatarDataUrl,
  onPlayAgain,
}: {
  name: string;
  result: BargainResponse;
  itemName: string;
  askingPrice: number;
  marketName: string;
  city: string;
  vendorName: string;
  avatarDataUrl: string | null;
  onPlayAgain: () => void;
}) {
  const success = result.session_status === "DEAL_SUCCESS";
  const finalPrice = success ? Math.round(result.current_counter_offer) : askingPrice;
  const savings = success ? result.discount_percentage : 0;

  const [stealth, setStealth] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  // Client-only feature detect; the server snapshot is false so hydration matches.
  const canNativeShare = useSyncExternalStore(
    () => () => {},
    () =>
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function",
    () => false
  );

  // `stealth` is read here, at generation time, from the current render's state.
  async function buildCard(): Promise<{ blob: Blob; filename: string }> {
    const canvas = await renderShareCard({
      playerName: name,
      avatarDataUrl,
      itemName,
      marketName,
      city,
      askingPrice,
      finalPrice,
      savingsPct: savings,
      badge: result.badge_awarded ?? null,
      success,
      stealth,
      origin: window.location.origin,
    });
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("could not encode image");
    return { blob, filename: stealth ? "my-haul.png" : "mol-bhav-scorecard.png" };
  }

  async function downloadCard() {
    setPreparing(true);
    setShareError(null);
    try {
      const { blob, filename } = await buildCard();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setShareError("Couldn't make the image — try again.");
    } finally {
      setPreparing(false);
    }
  }

  // Shares the real image file through the OS share sheet (WhatsApp, etc.).
  async function shareCardNatively() {
    setPreparing(true);
    setShareError(null);
    try {
      const { blob, filename } = await buildCard();
      const file = new File([blob], filename, { type: "image/png" });
      if (!navigator.canShare?.({ files: [file] })) {
        setShareError("Your browser can't share files — use Download instead.");
        return;
      }
      await navigator.share({
        files: [file],
        text: shareMessage({
          success,
          itemName,
          marketName,
          finalPrice,
          savingsPct: savings,
          origin: window.location.origin,
        }),
      });
    } catch (e) {
      // A user dismissing the share sheet throws AbortError — not an error worth showing.
      if (!(e instanceof Error) || e.name !== "AbortError") {
        setShareError("Couldn't open the share sheet — use Download instead.");
      }
    } finally {
      setPreparing(false);
    }
  }

  function challengeFriend() {
    const msg = shareMessage({
      success,
      itemName,
      marketName,
      finalPrice,
      savingsPct: savings,
      origin: window.location.origin,
    });
    window.open(whatsappUrl(msg), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 md:px-10 py-10">
      <div className="max-w-2xl">
        <p className="label text-[var(--ink-40)] mb-3">
          {success ? "Deal closed" : "Deal failed"} · Session over
        </p>

        <div className="flex items-start gap-6 flex-wrap">
          <h2
            className="font-display font-extrabold tracking-[-0.06em] leading-[0.8] text-[clamp(72px,13vw,150px)]"
            style={{ color: success ? "var(--green)" : "var(--pink)" }}
          >
            {success ? "SOLD." : "OUT."}
          </h2>

          {result.badge_awarded && (
            <div
              className="stamp mt-3 border-2 border-[var(--ink)] bg-[var(--paper)] px-4 py-3 hard-shadow max-w-[190px]"
              style={{ transform: "rotate(-3deg)" }}
            >
              <p className="label text-[var(--ink-40)] mb-1">Badge</p>
              <p className="font-display font-extrabold text-lg leading-tight tracking-[-0.02em]">
                {result.badge_awarded}
              </p>
            </div>
          )}
        </div>

        {result.sponsor_voucher && (
          <div className="mt-8 max-w-md border-2 border-[var(--ink)] bg-[var(--saffron)] p-5 hard-shadow">
            <p className="label text-[var(--ink)] opacity-70 mb-2">🎁 Voucher unlocked</p>
            <p className="font-display font-extrabold text-xl leading-tight tracking-[-0.02em]">
              You&apos;ve unlocked a voucher from {result.sponsor_voucher.sponsorName}
            </p>
            <p className="font-mono text-2xl font-bold mt-3 tracking-[0.08em] break-all">
              {result.sponsor_voucher.code}
            </p>
            <p className="text-sm mt-1">{result.sponsor_voucher.discountPercent}% off</p>
          </div>
        )}

        <blockquote className="mt-8 border-l-4 border-[var(--marigold)] pl-5">
          <p className="font-serif italic text-2xl leading-snug">
            &ldquo;{result.vendor_dialogue}&rdquo;
          </p>
          <footer className="label text-[var(--ink-40)] mt-2">— {vendorName}</footer>
        </blockquote>

        {/* Receipt */}
        <div className="receipt-wrap mt-10 max-w-md">
          <div className="receipt bg-[var(--ink)] text-[var(--paper)] px-6 pt-6">
            <div className="flex justify-between label opacity-70 gap-3">
              <span className="truncate">{marketName}</span>
              <span className="shrink-0">No. 0042</span>
            </div>

            <p className="font-display font-extrabold text-2xl tracking-[-0.03em] mt-3">Scorecard</p>

            <div className="my-4 border-t-2 border-dashed border-[rgba(255,253,247,0.3)]" />

            <div className="space-y-3 font-mono text-[13px]">
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-[0.12em] opacity-70 whitespace-nowrap">
                  Player
                </span>
                <span className="flex-1 dotted-leader" />
                <Avatar src={avatarDataUrl} size={26} />
                <span className="whitespace-nowrap">{name}</span>
              </div>
              <ReceiptRow label="Vendor" value={vendorName} />
              <ReceiptRow label="Item" value={itemName} />
              <ReceiptRow label="Asking" value={`₹${askingPrice}`} />
              <ReceiptRow label="Final price" value={`₹${finalPrice}`} highlight />
              <ReceiptRow label="Savings" value={`${savings.toFixed(1)}%`} highlight />
              {result.badge_awarded && <ReceiptRow label="Badge" value={result.badge_awarded} />}
            </div>

            <div className="my-4 border-t-2 border-dashed border-[rgba(255,253,247,0.3)]" />

            <div className="barcode h-11 w-full" />
            <p className="label text-center mt-3 opacity-70">Thank you · Come again</p>
          </div>
        </div>

        {/* Share */}
        <div className="mt-10 max-w-md border-2 border-[var(--ink)] bg-[var(--cream)] p-5">
          <p className="label text-[var(--ink-40)] mb-4">Share the damage</p>

          <label className="flex items-start gap-3 cursor-pointer mb-5">
            <input
              type="checkbox"
              checked={stealth}
              onChange={(e) => setStealth(e.target.checked)}
              className="mt-1 w-5 h-5 accent-[var(--marigold)] shrink-0"
            />
            <span>
              <span className="font-display font-extrabold text-lg tracking-[-0.02em]">
                🥷 Stealth Mode
              </span>
              <span className="block text-sm text-[var(--ink-60)] leading-snug mt-0.5">
                Just the haul — no badge, no savings, no trace of the game.
              </span>
            </span>
          </label>

          <div className="flex flex-col gap-3">
            {canNativeShare && (
              <button
                type="button"
                onClick={shareCardNatively}
                disabled={preparing}
                className="w-full border-2 border-[var(--ink)] bg-[var(--marigold)] text-[var(--paper)] py-4 min-h-[56px] hard-shadow-sm press font-display font-extrabold text-lg tracking-[-0.02em] disabled:opacity-50 disabled:pointer-events-none"
              >
                {preparing ? "Generating card…" : "📤 Share Card"}
              </button>
            )}
            <button
              type="button"
              onClick={downloadCard}
              disabled={preparing}
              className="w-full border-2 border-[var(--ink)] bg-[var(--paper)] py-4 min-h-[56px] hard-shadow-sm press font-display font-extrabold text-lg tracking-[-0.02em] disabled:opacity-50 disabled:pointer-events-none"
            >
              {preparing ? "Generating card…" : "⬇️ Download Card"}
            </button>
            <button
              type="button"
              onClick={challengeFriend}
              className="w-full border-2 border-[var(--ink)] bg-[var(--green)] text-[var(--paper)] py-4 min-h-[56px] hard-shadow-sm press font-display font-extrabold text-lg tracking-[-0.02em]"
            >
              💬 Challenge a Friend
            </button>
          </div>

          {shareError && <p className="label text-[var(--pink)] mt-3">{shareError}</p>}
        </div>

        <button
          onClick={onPlayAgain}
          className="mt-6 mb-4 w-full max-w-md border-2 border-[var(--ink)] bg-[var(--marigold)] text-[var(--paper)] py-5 hard-shadow press font-display font-extrabold text-xl tracking-[-0.02em]"
        >
          🔄 Play Again
        </button>
      </div>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="uppercase tracking-[0.12em] opacity-70 whitespace-nowrap">{label}</span>
      <span className="flex-1 dotted-leader" />
      <span
        className={`whitespace-nowrap ${highlight ? "font-bold text-[var(--marigold)] text-base" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
