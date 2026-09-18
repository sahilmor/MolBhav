"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Mode = "signin" | "signup";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Only same-origin paths are honoured. `next` is attacker-controllable, and
  // pushing an absolute URL would turn this page into an open redirect: sign in
  // on the real domain, get bounced to a lookalike that asks for the password
  // again. "//evil.com" is protocol-relative, so it has to be rejected too.
  const rawNext = params.get("next");
  const next = rawNext && /^\/(?!\/)/.test(rawNext) ? rawNext : null;

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(mode === "signin" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong.");
        return;
      }
      // Role decides the destination — admins land in the control panel.
      const role = data?.user?.role;
      router.push(next || (role === "admin" ? "/admin" : "/account"));
      router.refresh();
    } catch {
      setError("Couldn't reach the server — try again.");
    } finally {
      setBusy(false);
    }
  }

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-16">
      <div className="grain" />

      <div className="w-full max-w-md">
        <Link href="/" className="label text-[var(--ink-40)] hover:text-[var(--ink)] transition-colors">
          ← Mol Bhav
        </Link>

        <div className="mt-4 border-2 border-[var(--ink)] bg-[var(--paper)] hard-shadow">
          {/* Tabs */}
          <div className="grid grid-cols-2 border-b-2 border-[var(--ink)]">
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`py-4 label font-bold transition-colors ${
                  mode === m
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "bg-[var(--paper)] text-[var(--ink-40)] hover:text-[var(--ink)]"
                } ${m === "signin" ? "border-r-2 border-[var(--ink)]" : ""}`}
              >
                {m === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="p-7">
            <h1 className="font-display font-extrabold text-3xl tracking-[-0.03em] leading-none">
              {mode === "signin" ? "Welcome back." : "Make an account."}
            </h1>
            <p className="text-sm text-[var(--ink-60)] mt-2 leading-snug">
              {mode === "signin"
                ? "You'll land wherever your account belongs."
                : "New accounts are regular shopper accounts."}
            </p>

            <label className="label text-[var(--ink-40)] block mt-7 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-transparent border-b-2 border-[var(--ink)] pb-2 font-display text-xl"
            />

            <label className="label text-[var(--ink-40)] block mt-6 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="w-full bg-transparent border-b-2 border-[var(--ink)] pb-2 font-display text-xl"
            />
            {mode === "signup" && (
              <p className="label text-[var(--ink-40)] mt-2">At least 8 characters</p>
            )}

            <button
              type="submit"
              disabled={busy || !email || !password}
              className="mt-8 w-full border-2 border-[var(--ink)] bg-[var(--marigold)] text-[var(--paper)] py-4 min-h-[56px] hard-shadow-sm press font-display font-extrabold text-lg disabled:opacity-40 disabled:pointer-events-none"
            >
              {busy ? "Working…" : mode === "signin" ? "Sign in →" : "Create account →"}
            </button>

            {error && <p className="label text-[var(--pink)] mt-4">{error}</p>}
          </form>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <LoginForm />
    </Suspense>
  );
}
