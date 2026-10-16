import { describe, expect, it } from "vitest";
import { signPrintToken, verifyPrintToken } from "../src/server";

describe("utskriftstoken", () => {
  it("verifierar en giltig token", () => {
    const t = signPrintToken({ d: "dash", w: "ws" }, "hemlig");
    expect(verifyPrintToken(t, "hemlig")).toMatchObject({ d: "dash", w: "ws" });
  });
  it("avvisar fel hemlighet, manipulerad data och utgången token", () => {
    const t = signPrintToken({ d: "dash", w: "ws" }, "hemlig");
    expect(verifyPrintToken(t, "annan")).toBeNull();
    const [p, s] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ d: "annan-dashboard", w: "ws", exp: 9e9 })).toString("base64url");
    expect(verifyPrintToken(`${forged}.${s}`, "hemlig")).toBeNull();
    expect(verifyPrintToken(signPrintToken({ d: "x", w: "y" }, "hemlig", -1), "hemlig")).toBeNull();
    expect(verifyPrintToken(`${p}`, "hemlig")).toBeNull();
  });
});
