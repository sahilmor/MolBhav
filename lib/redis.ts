import { Redis } from "@upstash/redis";

export interface Sponsor {
  id: string;
  name: string;
  emoji: string;
  discountPercent: number;
  active: boolean;
  createdAt: string;
}

export interface AdminConfig {
  campaignActive: boolean;
  savageBossWinRateOverride: number;
}

export const SPONSORS_KEY = "sponsors";
export const ADMIN_CONFIG_KEY = "admin_config";

export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  campaignActive: true,
  savageBossWinRateOverride: 0.02,
};

function seedSponsors(): Sponsor[] {
  const now = new Date().toISOString();
  return [
    { name: "UrbanThreads", emoji: "👕", discountPercent: 15 },
    { name: "SpiceRoute Foods", emoji: "🌶️", discountPercent: 10 },
    { name: "TrendBazaar", emoji: "🛍️", discountPercent: 20 },
  ].map((s) => ({ ...s, id: crypto.randomUUID(), active: true, createdAt: now }));
}

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redisConfigured = Boolean(url && token);

const redis = redisConfigured ? new Redis({ url: url!, token: token! }) : null;

/**
 * Without Upstash credentials the app falls back to a per-instance memory store so
 * the game and admin panel still run. That store does NOT persist across restarts
 * or serverless instances — `redisConfigured` is surfaced in the admin UI to say so.
 */
const memory = new Map<string, unknown>();

async function readKey<T>(key: string): Promise<T | null> {
  if (redis) {
    try {
      return (await redis.get<T>(key)) ?? null;
    } catch (e) {
      console.error(`Redis read failed for "${key}":`, e);
      return (memory.get(key) as T) ?? null;
    }
  }
  return (memory.get(key) as T) ?? null;
}

async function writeKey(key: string, value: unknown): Promise<void> {
  memory.set(key, value);
  if (redis) {
    try {
      await redis.set(key, value);
    } catch (e) {
      console.error(`Redis write failed for "${key}":`, e);
      throw e;
    }
  }
}

export async function getSponsors(): Promise<Sponsor[]> {
  const existing = await readKey<Sponsor[]>(SPONSORS_KEY);
  if (Array.isArray(existing)) return existing;
  const seeded = seedSponsors();
  await writeKey(SPONSORS_KEY, seeded);
  return seeded;
}

export async function setSponsors(sponsors: Sponsor[]): Promise<void> {
  await writeKey(SPONSORS_KEY, sponsors);
}

export async function getAdminConfig(): Promise<AdminConfig> {
  const existing = await readKey<Partial<AdminConfig>>(ADMIN_CONFIG_KEY);
  if (existing && typeof existing === "object") {
    return {
      campaignActive:
        typeof existing.campaignActive === "boolean"
          ? existing.campaignActive
          : DEFAULT_ADMIN_CONFIG.campaignActive,
      savageBossWinRateOverride:
        typeof existing.savageBossWinRateOverride === "number"
          ? existing.savageBossWinRateOverride
          : DEFAULT_ADMIN_CONFIG.savageBossWinRateOverride,
    };
  }
  await writeKey(ADMIN_CONFIG_KEY, DEFAULT_ADMIN_CONFIG);
  return DEFAULT_ADMIN_CONFIG;
}

export async function setAdminConfig(config: AdminConfig): Promise<void> {
  await writeKey(ADMIN_CONFIG_KEY, config);
}
