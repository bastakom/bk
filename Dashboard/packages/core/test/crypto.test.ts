import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../src/server";

const key = randomBytes(32).toString("base64");

describe("token-kryptering", () => {
  it("krypterar och dekrypterar", () => {
    const enc = encryptSecret('{"accessToken":"abc"}', key);
    expect(enc).not.toContain("abc");
    expect(decryptSecret(enc, key)).toBe('{"accessToken":"abc"}');
  });

  it("ger olika chiffertext varje gång", () => {
    expect(encryptSecret("x", key)).not.toBe(encryptSecret("x", key));
  });

  it("avvisar manipulerad data", () => {
    const enc = encryptSecret("hemligt", key);
    const parts = enc.split(":");
    parts[3] = Buffer.from("manipulerat").toString("base64url");
    expect(() => decryptSecret(parts.join(":"), key)).toThrow();
  });
});
