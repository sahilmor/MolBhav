import bcrypt from "bcryptjs";
import { getDb, dbConfigured } from "@/lib/db";
import type { Role } from "@/lib/session";

export interface AppUser {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
}

export type PublicUser = Pick<AppUser, "id" | "email" | "role" | "createdAt">;

const USERS = "users";

export function toPublic(u: AppUser): PublicUser {
  return { id: u.id, email: u.email, role: u.role, createdAt: u.createdAt };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Mirrors lib/db.ts: without MONGODB_URI we keep a per-instance store so the flow still runs. */
const memUsers: AppUser[] = [];

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const key = normalizeEmail(email);
  if (!dbConfigured) return memUsers.find((u) => u.email === key) ?? null;
  const col = (await getDb()).collection<AppUser>(USERS);
  return await col.findOne({ email: key }, { projection: { _id: 0 } });
}

export async function createUser(
  email: string,
  password: string,
  role: Role = "user"
): Promise<AppUser> {
  const user: AppUser = {
    id: crypto.randomUUID(),
    email: normalizeEmail(email),
    passwordHash: await bcrypt.hash(password, 10),
    role,
    createdAt: new Date().toISOString(),
  };
  if (!dbConfigured) {
    memUsers.push(user);
    return user;
  }
  const col = (await getDb()).collection<AppUser>(USERS);
  await col.createIndex({ email: 1 }, { unique: true });
  await col.insertOne({ ...user });
  return user;
}

export async function verifyCredentials(
  email: string,
  password: string
): Promise<AppUser | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  return (await bcrypt.compare(password, user.passwordHash)) ? user : null;
}
