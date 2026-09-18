"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Login failed.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Couldn't reach the server — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-16">
      <div className="grain" />
      <form onSubmit={onSubmit} className="w-full max-w-sm border-2 border-[var(--ink)] bg-[var(--paper)] p-7 hard-shadow">
        <p className="label text-[var(--ink-40)] mb-2">Mol Bhav</p>
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.03em] mb-6">Admin</h1>

        <label className="label text-[var(--ink-40)] block mb-2">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="w-full bg-transparent border-b-2 border-[var(--ink)] pb-2 mb-6 font-display text-2xl"
        />

        <button
          type="submit"
          disabled={busy || !password}
          className="w-full border-2 border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] py-4 min-h-[56px] hard-shadow-sm press font-display font-extrabold text-lg disabled:opacity-40 disabled:pointer-events-none"
        >
          {busy ? "Checking…" : "Sign in"}
        </button>

        {error && <p className="label text-[var(--pink)] mt-4">{error}</p>}
      </form>
    </main>
  );
}
