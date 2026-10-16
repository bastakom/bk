import { describe, expect, it } from "vitest";
import { friendlyError, sanitizeError } from "../src";

describe("friendlyError", () => {
  it("förklarar återkallad Meta-token med åtgärd", () => {
    const e = friendlyError("Meta-token är ogiltig eller återkallad: Error validating access token: The session has been invalidated. (kod 190, hämta insights)");
    expect(e?.text).toMatch(/Koppla om källan under Databaser/);
  });

  it("döljer databasfel och sökvägar", () => {
    const raw = "Invalid `tx.metricFact.createMany()` invocation in /Users/alexbk/Desktop/Analyze this/apps/web/.next/dev/server/chunks/ssr/x.js:5538:86 5535 }); 5537 let n = 0; → 5538 for(let i = 0; i < data.length; i += CHUNK)n += Unique constraint failed on the constraint: `metric_facts_key`";
    const e = friendlyError(raw)!;
    expect(e.text).toBe("Ett internt fel uppstod när data skulle sparas. Synken försöker igen vid nästa körning.");
    expect(e.detail).not.toMatch(/\/Users|alexbk|`/);
    expect(e.detail).toContain("Unique constraint failed");
  });

  it("visar korta svenska meddelanden oförändrade", () => {
    expect(friendlyError("Kontot hittades inte hos plattformen.")).toEqual({ text: "Kontot hittades inte hos plattformen." });
  });

  it("ger en allmän text för okända tekniska fel", () => {
    expect(friendlyError("TypeError: Cannot read properties of undefined (reading 'x') at foo (bar.ts:1)")?.text).toMatch(/Något gick fel/);
    expect(friendlyError(null)).toBeNull();
  });

  it("tar bort Windows- och Unix-sökvägar", () => {
    expect(sanitizeError("fel i C:\\app\\x.js och /home/u/y.ts")).toBe("fel i … och …");
  });
});
