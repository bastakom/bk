/**
 * Signerade adresser till annonsernas bilder och uppspelning. Samma adress fungerar
 * i appen, på delade länkar och i PDF-rendering (ingen inloggning krävs), men bara
 * för den annons och byrå den skapades för och bara en tid.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export type MediaKind = "image" | "play";
const TTL_SECONDS = 7 * 24 * 3600;

const sign = (payload: string) => createHmac("sha256", process.env.BETTER_AUTH_SECRET!).update(`media:${payload}`).digest("base64url");

export function mediaUrl(workspaceId: string, creativeId: string, kind: MediaKind): string {
  // Avrundad utgång ger samma adress inom samma dygn, så att webbläsaren kan cacha bilden.
  const exp = (Math.floor(Date.now() / 1000 / 86400) + 1) * 86400 + TTL_SECONDS;
  const q = new URLSearchParams({ w: workspaceId, e: String(exp), s: sign(`${workspaceId}:${creativeId}:${kind}:${exp}`) });
  return `/api/media/${creativeId}/${kind}?${q}`;
}

/** Byrå-id om signaturen stämmer och inte gått ut, annars null. */
export function verifyMedia(creativeId: string, kind: MediaKind, params: URLSearchParams): string | null {
  const w = params.get("w") ?? "";
  const exp = Number(params.get("e"));
  const given = Buffer.from(params.get("s") ?? "", "base64url");
  const expected = Buffer.from(sign(`${w}:${creativeId}:${kind}:${exp}`), "base64url");
  if (!w || !exp || exp < Date.now() / 1000 || given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return w;
}
