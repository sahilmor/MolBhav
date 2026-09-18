"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface AdminConfig {
  campaignActive: boolean;
  savageBossWinRateOverride: number;
}

export default function AdminDashboard() {
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [dbConfigured, setDbConfigured] = useState(true);
  const [rateInput, setRateInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setConfig(d.config);
        setDbConfigured(d.dbConfigured);
        setRateInput(String((d.config.savageBossWinRateOverride * 100).toFixed(2)));
      })
      .catch(() => !cancelled && setError("Couldn't load config."));
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(patch: Partial<AdminConfig>) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Save failed.");
        return;
      }
      setConfig(data.config);
      setRateInput(String((data.config.savageBossWinRateOverride * 100).toFixed(2)));
      setStatus("Saved.");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!config) {
    return (
      <main className="min-h-screen p-8">
        <p className="label text-[var(--ink-40)]">{error ?? "Loading…"}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-5 sm:px-8 py-12">
      <div className="grain" />

      <div className="flex items-baseline justify-between gap-4 mb-10 pb-4 border-b-2 border-[var(--ink)]">
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.03em]">Admin</h1>
        <Link href="/admin/sponsors" className="label font-bold border-2 border-[var(--ink)] px-4 py-2.5 hard-shadow-sm press">
          Sponsors →
        </Link>
      </div>

      {!dbConfigured && (
        <div className="border-2 border-[var(--pink)] bg-[var(--pink)] text-[var(--paper)] p-4 mb-8">
          <p className="label leading-relaxed">
            No MONGODB_URI set — running on a per-instance memory store. Changes will NOT
            persist across restarts or serverless instances.
          </p>
        </div>
      )}

      {/* Kill switch */}
      <section className="border-2 border-[var(--ink)] bg-[var(--paper)] p-6 mb-6 hard-shadow-sm">
        <p className="label text-[var(--ink-40)] mb-3">Campaign kill switch</p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.campaignActive}
            disabled={busy}
            onChange={(e) => save({ campaignActive: e.target.checked })}
            className="mt-1 w-5 h-5 accent-[var(--marigold)] shrink-0"
          />
          <span>
            <span className="font-display font-extrabold text-xl tracking-[-0.02em]">
              Sponsor campaign {config.campaignActive ? "ACTIVE" : "OFF"}
            </span>
            <span className="block text-sm text-[var(--ink-60)] mt-0.5 leading-snug">
              When off, winners get no voucher. Sponsor records stay intact.
            </span>
          </span>
        </label>
      </section>

      {/* Win rate */}
      <section className="border-2 border-[var(--ink)] bg-[var(--paper)] p-6 hard-shadow-sm">
        <p className="label text-[var(--ink-40)] mb-3">Savage Boss win-rate override (0.01%–5.00%)</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="5"
            value={rateInput}
            disabled={busy}
            onChange={(e) => setRateInput(e.target.value)}
            className="w-32 bg-transparent border-b-2 border-[var(--ink)] pb-2 font-display text-3xl font-extrabold"
          />
          <span className="font-display font-extrabold text-2xl">%</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const pct = Number(rateInput);
              if (!Number.isFinite(pct) || pct < 0.01 || pct > 5) {
                setError("Enter a value between 0.01% and 5.00%.");
                return;
              }
              save({ savageBossWinRateOverride: pct / 100 });
            }}
            className="border-2 border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] px-6 py-3 min-h-[48px] hard-shadow-sm press label font-bold disabled:opacity-40"
          >
            Save
          </button>
        </div>
        <p className="text-sm text-[var(--ink-60)] mt-3 leading-snug">
          Currently <strong>{(config.savageBossWinRateOverride * 100).toFixed(2)}%</strong> of
          over-the-cap Savage Boss offers slip through as a win instead of a ban.
        </p>
      </section>

      {status && <p className="label text-[var(--green)] mt-5">{status}</p>}
      {error && <p className="label text-[var(--pink)] mt-5">{error}</p>}
    </main>
  );
}
