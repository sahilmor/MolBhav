"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import Link from "next/link";

interface Sponsor {
  id: string;
  name: string;
  emoji: string;
  discountPercent: number;
  active: boolean;
  createdAt: string;
}

export default function SponsorManager() {
  const [sponsors, setSponsors] = useState<Sponsor[] | null>(null);
  const [dbConfigured, setDbConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [discount, setDiscount] = useState("10");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sponsors");
      if (!res.ok) throw new Error();
      const d = await res.json();
      setSponsors(d.sponsors);
      setDbConfigured(d.dbConfigured);
    } catch {
      setError("Couldn't load sponsors.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/sponsors")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setSponsors(d.sponsors);
        setDbConfigured(d.dbConfigured);
      })
      .catch(() => !cancelled && setError("Couldn't load sponsors."));
    return () => {
      cancelled = true;
    };
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sponsors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, emoji, discountPercent: Number(discount) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d?.error ?? "Couldn't add sponsor.");
        return;
      }
      setName("");
      setEmoji("");
      setDiscount("10");
      await load();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(s: Sponsor) {
    setBusy(true);
    try {
      await fetch(`/api/admin/sponsors/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !s.active }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: Sponsor) {
    setBusy(true);
    try {
      await fetch(`/api/admin/sponsors/${s.id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen max-w-4xl mx-auto px-5 sm:px-8 py-12">
      <div className="grain" />

      <div className="flex items-baseline justify-between gap-4 mb-10 pb-4 border-b-2 border-[var(--ink)]">
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.03em]">Sponsors</h1>
        <Link href="/admin" className="label font-bold border-2 border-[var(--ink)] px-4 py-2.5 hard-shadow-sm press">
          ← Dashboard
        </Link>
      </div>

      {!dbConfigured && (
        <div className="border-2 border-[var(--pink)] bg-[var(--pink)] text-[var(--paper)] p-4 mb-8">
          <p className="label leading-relaxed">
            No MONGODB_URI set — memory store only. Changes will NOT persist.
          </p>
        </div>
      )}

      {/* Add form */}
      <form onSubmit={add} className="border-2 border-[var(--ink)] bg-[var(--paper)] p-6 mb-8 hard-shadow-sm">
        <p className="label text-[var(--ink-40)] mb-4">Add a sponsor</p>
        <div className="grid sm:grid-cols-[1fr_90px_110px_auto] gap-3 items-end">
          <div>
            <label className="label text-[var(--ink-40)] block mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-transparent border-b-2 border-[var(--ink)] pb-2 font-display text-xl"
            />
          </div>
          <div>
            <label className="label text-[var(--ink-40)] block mb-1.5">Emoji</label>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="🎁"
              className="w-full bg-transparent border-b-2 border-[var(--ink)] pb-2 font-display text-xl"
            />
          </div>
          <div>
            <label className="label text-[var(--ink-40)] block mb-1.5">Discount %</label>
            <input
              type="number"
              min="1"
              max="100"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="w-full bg-transparent border-b-2 border-[var(--ink)] pb-2 font-display text-xl"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="border-2 border-[var(--ink)] bg-[var(--marigold)] text-[var(--paper)] px-5 py-3 min-h-[48px] hard-shadow-sm press label font-bold disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </form>

      {error && <p className="label text-[var(--pink)] mb-5">{error}</p>}

      {/* Table */}
      <div className="border-2 border-[var(--ink)] bg-[var(--paper)] hard-shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[520px]">
          <thead>
            <tr className="border-b-2 border-[var(--ink)]">
              <th className="label text-[var(--ink-40)] p-4">Sponsor</th>
              <th className="label text-[var(--ink-40)] p-4">Discount</th>
              <th className="label text-[var(--ink-40)] p-4">Status</th>
              <th className="label text-[var(--ink-40)] p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sponsors === null && (
              <tr>
                <td colSpan={4} className="p-5 label text-[var(--ink-40)]">Loading…</td>
              </tr>
            )}
            {sponsors?.length === 0 && (
              <tr>
                <td colSpan={4} className="p-5 label text-[var(--ink-40)]">No sponsors yet.</td>
              </tr>
            )}
            {sponsors?.map((s) => (
              <tr key={s.id} className="border-b border-[var(--ink-18)] last:border-0">
                <td className="p-4">
                  <span className="font-display font-extrabold text-lg tracking-[-0.02em]">
                    {s.emoji} {s.name}
                  </span>
                </td>
                <td className="p-4 font-mono text-sm">{s.discountPercent}%</td>
                <td className="p-4">
                  <span
                    className="label font-bold px-2 py-1 text-[var(--paper)]"
                    style={{ background: s.active ? "var(--green)" : "var(--ink-40)" }}
                  >
                    {s.active ? "Active" : "Paused"}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => toggle(s)}
                      disabled={busy}
                      className="label font-bold border-2 border-[var(--ink)] px-3 py-2 min-h-[40px] press disabled:opacity-40"
                    >
                      {s.active ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(s)}
                      disabled={busy}
                      className="label font-bold border-2 border-[var(--pink)] text-[var(--pink)] px-3 py-2 min-h-[40px] press disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
