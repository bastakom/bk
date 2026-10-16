import { describe, expect, it } from "vitest";
import { ConnectorAuthError, ConnectorRetryableError, RateLimiter, retryAfterMs, withRetry } from "../src";

const noSleep = async () => {};

describe("withRetry", () => {
  it("försöker igen vid tillfälliga fel och lyckas", async () => {
    let calls = 0;
    const res = await withRetry(
      async () => {
        if (++calls < 3) throw new ConnectorRetryableError("429");
        return "ok";
      },
      { sleep: noSleep },
    );
    expect(res).toBe("ok");
    expect(calls).toBe(3);
  });

  it("ger upp efter max antal försök", async () => {
    let calls = 0;
    await expect(withRetry(async () => { calls++; throw new ConnectorRetryableError("503"); }, { retries: 2, sleep: noSleep })).rejects.toThrow("503");
    expect(calls).toBe(3);
  });

  it("försöker aldrig igen vid behörighetsfel", async () => {
    let calls = 0;
    await expect(withRetry(async () => { calls++; throw new ConnectorAuthError("revoked"); }, { sleep: noSleep })).rejects.toBeInstanceOf(ConnectorAuthError);
    expect(calls).toBe(1);
  });

  it("väntar minst Retry-After", async () => {
    const waits: number[] = [];
    let calls = 0;
    await withRetry(
      async () => {
        if (++calls === 1) throw new ConnectorRetryableError("kvot", 30_000);
        return 1;
      },
      { sleep: async (ms) => void waits.push(ms) },
    );
    expect(waits[0]).toBeGreaterThanOrEqual(30_000);
  });
});

describe("RateLimiter", () => {
  it("kör aldrig fler än tillåtet samtidigt", async () => {
    const lim = new RateLimiter(2);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 6 }, () =>
        lim.run(async () => {
          peak = Math.max(peak, ++active);
          await new Promise((r) => setTimeout(r, 5));
          active--;
        }),
      ),
    );
    expect(peak).toBe(2);
  });
});

it("tolkar Retry-After", () => {
  expect(retryAfterMs("12")).toBe(12_000);
  expect(retryAfterMs(null)).toBeUndefined();
});
