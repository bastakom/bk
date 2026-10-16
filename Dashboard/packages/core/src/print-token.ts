/**
 * Kortlivad, signerad token för utskriftsvyn. Headless Chromium har ingen
 * inloggad session; token ger läsrätt till exakt en dashboard i en byrå
 * under några minuter. HMAC-SHA256 med serverns hemlighet.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface PrintClaims {
  /** Dashboard-id */
  d: string;
  /** Byrå (workspace)-id */
  w: string;
  /** Utgång, epoch sekunder */
  exp: number;
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");

export function signPrintToken(claims: Omit<PrintClaims, "exp">, secret: string, ttlSeconds = 300): string {
  const payload = b64(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyPrintToken(token: string, secret: string): PrintClaims | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as PrintClaims;
    return claims.exp > Date.now() / 1000 ? claims : null;
  } catch {
    return null;
  }
}
