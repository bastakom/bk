/**
 * Delningslänkar för kunder utan inloggning.
 *  - Token: 32 slumpade byte – går inte att gissa.
 *  - Lösenord: scrypt med salt; efter rätt lösenord sätts en signerad cookie
 *    bunden till länkens lösenordshash (byts lösenordet blir gamla cookies ogiltiga).
 *  - Gissningsskydd: högst 5 felaktiga försök per länk och IP-adress per 15 minuter.
 */
import "server-only";
import { db } from "@rp/db";
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const newShareToken = () => randomBytes(32).toString("base64url");

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(password, Buffer.from(salt, "base64url"), expected.length);
  return timingSafeEqual(actual, expected);
}

export interface ShareRow {
  id: string;
  workspaceId: string;
  dashboardId: string;
  passwordHash: string | null;
  expiresAt: Date | null;
  allowDateChange: boolean;
  allowPdf: boolean;
}

/** Slår upp en giltig (ej återkallad/utgången) länk via databasfunktionen share_link_by_token. */
export async function resolveShare(token: string): Promise<ShareRow | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const rows = await db.$queryRaw<ShareRow[]>`SELECT * FROM share_link_by_token(${token})`;
  return rows[0] ?? null;
}

const cookieName = (id: string) => `rp_share_${id}`;
const cookieValue = (link: ShareRow) => createHmac("sha256", process.env.BETTER_AUTH_SECRET!).update(`${link.id}:${link.passwordHash}`).digest("base64url");

export async function hasShareAccess(link: ShareRow): Promise<boolean> {
  if (!link.passwordHash) return true;
  const got = (await cookies()).get(cookieName(link.id))?.value;
  if (!got) return false;
  const want = cookieValue(link);
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export async function grantShareAccess(link: ShareRow, token: string) {
  (await cookies()).set(cookieName(link.id), cookieValue(link), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/s/${token}`,
    maxAge: 7 * 86_400,
  });
}

const attempts = new Map<string, { count: number; resetAt: number }>();

/** true om ytterligare ett försök är tillåtet; räknar upp vid misslyckande. */
export function allowAttempt(key: string, failed = false): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.resetAt < now) {
    if (failed) attempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    return true;
  }
  if (failed) a.count++;
  return a.count < 5;
}
