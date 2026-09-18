"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Me {
  id: string;
  email: string;
  role: "user" | "admin";
}

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setMe(d?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-5 sm:px-8 py-12">
      <div className="grain" />

      <div className="flex items-baseline justify-between gap-4 mb-10 pb-4 border-b-2 border-[var(--ink)]">
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.03em]">Your account</h1>
        <Link href="/" className="label font-bold border-2 border-[var(--ink)] px-4 py-2.5 hard-shadow-sm press">
          ← Home
        </Link>
      </div>

      {loading ? (
        <p className="label text-[var(--ink-40)]">Loading…</p>
      ) : !me ? (
        <p className="label text-[var(--ink-40)]">Not signed in.</p>
      ) : (
        <>
          <section className="border-2 border-[var(--ink)] bg-[var(--paper)] p-6 hard-shadow-sm">
            <p className="label text-[var(--ink-40)] mb-2">Signed in as</p>
            <p className="font-display font-extrabold text-2xl tracking-[-0.02em] break-all">
              {me.email}
            </p>
            <span
              className="inline-block mt-4 label font-bold px-3 py-1.5 text-[var(--paper)]"
              style={{ background: me.role === "admin" ? "var(--violet)" : "var(--green)" }}
            >
              {me.role === "admin" ? "Admin" : "Shopper"}
            </span>
          </section>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href="/play"
              className="flex-1 text-center border-2 border-[var(--ink)] bg-[var(--marigold)] text-[var(--paper)] py-4 min-h-[56px] hard-shadow-sm press font-display font-extrabold text-lg"
            >
              Start haggling →
            </Link>
            {me.role === "admin" && (
              <Link
                href="/admin"
                className="flex-1 text-center border-2 border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] py-4 min-h-[56px] hard-shadow-sm press font-display font-extrabold text-lg"
              >
                Admin panel →
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={logout}
            className="mt-6 label font-bold border-2 border-[var(--ink-18)] text-[var(--ink-40)] px-4 py-3 min-h-[44px] press"
          >
            Sign out
          </button>
        </>
      )}
    </main>
  );
}
