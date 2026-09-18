import { MongoClient, type Db } from "mongodb";

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

export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  campaignActive: true,
  savageBossWinRateOverride: 0.02,
};

const SPONSORS = "sponsors";
const CONFIG = "config";
const CONFIG_ID = "admin_config";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "molbhav";

export const dbConfigured = Boolean(uri);

// Serverless invocations reuse the same process, so the client is cached on
// globalThis to avoid opening a new connection pool per request.
declare global {
  var _molBhavMongo: Promise<MongoClient> | undefined;
}

function connect(): Promise<MongoClient> {
  if (!uri) throw new Error("MONGODB_URI is not set");
  if (!globalThis._molBhavMongo) {
    globalThis._molBhavMongo = new MongoClient(uri).connect();
  }
  return globalThis._molBhavMongo;
}

async function db(): Promise<Db> {
  return (await connect()).db(dbName);
}

/**
 * Without MONGODB_URI the app falls back to a per-instance memory store so the
 * game and admin panel still run. It does NOT persist across restarts or
 * serverless instances — `dbConfigured` is surfaced in the admin UI to say so.
 */
const memSponsors: Sponsor[] = [];
let memConfig: AdminConfig | null = null;
let memSeeded = false;

function seedList(): Sponsor[] {
  const now = new Date().toISOString();
  return [
    { name: "UrbanThreads", emoji: "👕", discountPercent: 15 },
    { name: "SpiceRoute Foods", emoji: "🌶️", discountPercent: 10 },
    { name: "TrendBazaar", emoji: "🛍️", discountPercent: 20 },
  ].map((s) => ({ ...s, id: crypto.randomUUID(), active: true, createdAt: now }));
}

function memSeed() {
  if (memSeeded) return;
  memSponsors.push(...seedList());
  memConfig = { ...DEFAULT_ADMIN_CONFIG };
  memSeeded = true;
}

export async function getSponsors(): Promise<Sponsor[]> {
  if (!dbConfigured) {
    memSeed();
    return [...memSponsors];
  }
  const col = (await db()).collection<Sponsor>(SPONSORS);
  const found = await col.find({}, { projection: { _id: 0 } }).sort({ createdAt: 1 }).toArray();
  if (found.length > 0) return found;

  const seeded = seedList();
  await col.insertMany(seeded.map((s) => ({ ...s })));
  return seeded;
}

export async function addSponsor(input: {
  name: string;
  emoji: string;
  discountPercent: number;
}): Promise<Sponsor> {
  const sponsor: Sponsor = {
    id: crypto.randomUUID(),
    name: input.name,
    emoji: input.emoji,
    discountPercent: input.discountPercent,
    active: true,
    createdAt: new Date().toISOString(),
  };
  if (!dbConfigured) {
    memSeed();
    memSponsors.push(sponsor);
    return sponsor;
  }
  await (await db()).collection<Sponsor>(SPONSORS).insertOne({ ...sponsor });
  return sponsor;
}

export async function setSponsorActive(id: string, active: boolean): Promise<Sponsor | null> {
  if (!dbConfigured) {
    memSeed();
    const s = memSponsors.find((x) => x.id === id);
    if (!s) return null;
    s.active = active;
    return { ...s };
  }
  // findOneAndUpdate is atomic, so concurrent admins can't clobber each other.
  const res = await (await db())
    .collection<Sponsor>(SPONSORS)
    .findOneAndUpdate({ id }, { $set: { active } }, { returnDocument: "after", projection: { _id: 0 } });
  return (res as Sponsor | null) ?? null;
}

export async function deleteSponsor(id: string): Promise<boolean> {
  if (!dbConfigured) {
    memSeed();
    const i = memSponsors.findIndex((x) => x.id === id);
    if (i === -1) return false;
    memSponsors.splice(i, 1);
    return true;
  }
  const res = await (await db()).collection<Sponsor>(SPONSORS).deleteOne({ id });
  return res.deletedCount > 0;
}

export async function getAdminConfig(): Promise<AdminConfig> {
  if (!dbConfigured) {
    memSeed();
    return { ...(memConfig ?? DEFAULT_ADMIN_CONFIG) };
  }
  const col = (await db()).collection<AdminConfig & { _id: string }>(CONFIG);
  const doc = await col.findOne({ _id: CONFIG_ID });
  if (doc) {
    return {
      campaignActive:
        typeof doc.campaignActive === "boolean"
          ? doc.campaignActive
          : DEFAULT_ADMIN_CONFIG.campaignActive,
      savageBossWinRateOverride:
        typeof doc.savageBossWinRateOverride === "number"
          ? doc.savageBossWinRateOverride
          : DEFAULT_ADMIN_CONFIG.savageBossWinRateOverride,
    };
  }
  await col.insertOne({ _id: CONFIG_ID, ...DEFAULT_ADMIN_CONFIG });
  return { ...DEFAULT_ADMIN_CONFIG };
}

export async function setAdminConfig(config: AdminConfig): Promise<void> {
  if (!dbConfigured) {
    memSeed();
    memConfig = { ...config };
    return;
  }
  await (await db())
    .collection<AdminConfig & { _id: string }>(CONFIG)
    .updateOne({ _id: CONFIG_ID }, { $set: config }, { upsert: true });
}
