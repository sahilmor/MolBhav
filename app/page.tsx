import Link from "next/link";

const FEATURES = [
  {
    emoji: "🗣️",
    title: "Real AI Vendors",
    body: "Gemini-powered personas with distinct personalities, haggling in Hinglish.",
    color: "var(--marigold)",
  },
  {
    emoji: "🏙️",
    title: "Real Markets",
    body: "Sarojini Nagar, Colaba Causeway, Banjara Market — pick one near you, weather and all.",
    color: "var(--terracotta)",
  },
  {
    emoji: "👑",
    title: "Gamified Bargaining",
    body: "Earn ranks and badges, from Boss Slayer to Certified Bakra.",
    color: "var(--saffron)",
  },
  {
    emoji: "🔥",
    title: "Pick Your Difficulty",
    body: "Easy, Hard, or the brutal Weekly Savage Boss mode.",
    color: "var(--pink)",
  },
];

const STEPS = [
  { n: "01", text: "Pick your market, item, and vendor" },
  { n: "02", text: "Set up your shopper profile (and snap a selfie)" },
  { n: "03", text: "Haggle it out in the chat — the vendor won't go easy" },
  { n: "04", text: "Walk away with a deal, a floor-price win, or get banned — then share your scorecard" },
];

function Squiggle() {
  return (
    <svg
      className="absolute left-0 w-full pointer-events-none"
      style={{ bottom: "-0.28em" }}
      height="14"
      viewBox="0 0 200 14"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
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

function StartButton({ label = "Start Haggling" }: { label?: string }) {
  return (
    <Link
      href="/play"
      className="inline-flex items-center justify-center gap-3 border-2 border-[var(--ink)] bg-[var(--marigold)] text-[var(--paper)] px-8 py-5 min-h-[60px] hard-shadow press font-display font-extrabold text-xl sm:text-2xl tracking-[-0.02em]"
    >
      {label}
      <span aria-hidden>→</span>
    </Link>
  );
}

export default function Landing() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="grain" />

      {/* Ticker */}
      <div className="border-b-2 border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] overflow-hidden py-2">
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

      {/* Top bar */}
      <header className="border-b-2 border-[var(--ink)] bg-[var(--paper)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <span className="font-display font-extrabold text-lg tracking-[-0.03em]">
            MOL BHAV<span className="text-[var(--marigold)]">.</span>
          </span>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="label font-bold border-2 border-[var(--ink)] bg-[var(--paper)] px-4 py-2.5 min-h-[44px] flex items-center hard-shadow-sm press"
            >
              Log in
            </Link>
            <Link
              href="/play"
              className="label font-bold border-2 border-[var(--ink)] bg-[var(--marigold)] text-[var(--paper)] px-4 py-2.5 min-h-[44px] flex items-center hard-shadow-sm press"
            >
              Play now →
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b-2 border-[var(--ink)]">
        <span
          aria-hidden
          className="pointer-events-none select-none absolute -right-6 top-6 text-[110px] sm:text-[170px] opacity-20 rotate-12"
        >
          🛍️
        </span>
        <span
          aria-hidden
          className="pointer-events-none select-none absolute left-[-18px] bottom-4 text-[80px] sm:text-[130px] opacity-15 -rotate-12"
        >
          🧵
        </span>
        <span
          aria-hidden
          className="pointer-events-none select-none absolute right-[18%] bottom-8 text-[60px] sm:text-[90px] opacity-15 rotate-6 hidden sm:block"
        >
          🏮
        </span>

        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <p className="label text-[var(--ink-40)] mb-5">A bargaining game · Live demo</p>

          <h1 className="font-display font-extrabold tracking-[-0.06em] leading-[0.82] text-[clamp(62px,15vw,170px)]">
            Mol Bhav<span className="text-[var(--marigold)]">.</span>
          </h1>

          <p className="mt-5 font-serif italic text-[clamp(24px,5vw,44px)] leading-[1.05] max-w-2xl relative inline-block">
            Everyone has a price. Find{" "}
            <span className="relative inline-block">
              theirs
              <Squiggle />
            </span>
            .
          </p>

          <p className="mt-8 sm:mt-10 max-w-xl text-lg sm:text-xl text-[var(--ink-60)] leading-relaxed">
            Chat and bargain with AI vendor personas from real Indian bazaars — Delhi, Mumbai,
            Hyderabad — without leaving your couch. They know their floor price. You don&apos;t.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-5">
            <StartButton />
            <p className="label text-[var(--ink-40)]">Free · No signup</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b-2 border-[var(--ink)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
          <div className="flex items-baseline gap-3 mb-10 pb-3 border-b-2 border-[var(--ink)]">
            <span className="font-mono text-xs font-bold text-[var(--marigold)]">01</span>
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-[-0.03em]">
              What you&apos;re getting into
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="border-2 border-[var(--ink)] bg-[var(--paper)] p-6 hard-shadow-sm flex flex-col"
              >
                <span
                  className="text-4xl w-14 h-14 border-2 border-[var(--ink)] flex items-center justify-center mb-5"
                  style={{ background: f.color }}
                  aria-hidden
                >
                  {f.emoji}
                </span>
                <h3 className="font-display font-extrabold text-xl tracking-[-0.02em] leading-tight">
                  {f.title}
                </h3>
                <p className="mt-2.5 text-[15px] text-[var(--ink-60)] leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b-2 border-[var(--ink)] bg-[var(--paper)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
          <div className="flex items-baseline gap-3 mb-10 pb-3 border-b-2 border-[var(--ink)]">
            <span className="font-mono text-xs font-bold text-[var(--marigold)]">02</span>
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-[-0.03em]">
              How it works
            </h2>
          </div>

          <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="flex sm:flex-col gap-4">
                <span
                  className="shrink-0 w-14 h-14 rounded-full border-2 border-[var(--ink)] bg-[var(--saffron)] hard-shadow-sm flex items-center justify-center font-display font-extrabold text-xl"
                  aria-hidden
                >
                  {s.n}
                </span>
                <p className="font-serif text-xl sm:text-[22px] leading-snug">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Secondary CTA */}
      <section className="border-b-2 border-[var(--ink)]" style={{ background: "var(--terracotta)" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20 text-[var(--paper)]">
          <h2 className="font-display font-extrabold tracking-[-0.04em] leading-[0.9] text-[clamp(34px,7vw,68px)] max-w-2xl">
            The vendor is waiting.
            <br />
            He&apos;s already sized you up.
          </h2>
          <p className="mt-6 max-w-lg text-lg opacity-85 leading-relaxed">
            One jacket, one shawl, one pair of knock-off sunglasses. See how far you can push him
            before the shutter comes down.
          </p>
          <div className="mt-10">
            <StartButton />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--cream)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="label text-[var(--ink-40)] leading-relaxed">
            Mol Bhav is a prototype / demo — not a real shop.
            <br />
            No payments, no orders, no actual jackets.
          </p>
          <p className="label text-[var(--ink-40)]">© 2026 Mol Bhav</p>
        </div>
      </footer>
    </main>
  );
}
