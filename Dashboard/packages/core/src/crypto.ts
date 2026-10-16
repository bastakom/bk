/**
 * Kryptering i vila för OAuth-tokens: AES-256-GCM med slumpad IV per värde.
 * Formatet "v1:<iv>:<tag>:<ciphertext>" (base64url) gör nyckelrotation möjlig.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(raw = process.env.TOKEN_ENCRYPTION_KEY): Buffer {
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY saknas");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY måste vara 32 byte (base64)");
  return k;
}

export function encryptSecret(plaintext: string, rawKey?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(rawKey), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(":");
}

export function decryptSecret(payload: string, rawKey?: string): string {
  const [version, iv, tag, ct] = payload.split(":");
  if (version !== "v1" || !iv || !tag || !ct) throw new Error("Okänt krypteringsformat");
  const decipher = createDecipheriv("aes-256-gcm", key(rawKey), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
