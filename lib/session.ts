export const SESSION_COOKIE = "admin_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

export type Role = "user" | "admin";

export interface Session {
  sub: string;
  email: string;
  role: Role;
  exp: number;
}

const encoder = new TextEncoder();

function b64urlEncode(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad)));
}

// Web Crypto so this works in both Node route handlers and the Edge proxy.
async function hmacHex(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(
  input: { sub: string; email: string; role: Role },
  secret: string
): Promise<string> {
  const payload = b64urlEncode(
    JSON.stringify({ ...input, exp: Date.now() + SESSION_TTL_MS } satisfies Session)
  );
  return `${payload}.${await hmacHex(payload, secret)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined
): Promise<Session | null> {
  if (!token || !secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;

  const payload = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const expected = await hmacHex(payload, secret);

  if (provided.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) return null;

  try {
    const session = JSON.parse(b64urlDecode(payload)) as Session;
    if (typeof session.exp !== "number" || session.exp <= Date.now()) return null;
    if (session.role !== "user" && session.role !== "admin") return null;
    return session;
  } catch {
    return null;
  }
}
