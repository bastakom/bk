import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectorAuthError } from "../src";
import { metaConnector } from "../src/connectors/meta";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const validate = (token: string) => (metaConnector.auth.type === "token" ? metaConnector.auth.validate(token) : Promise.reject(new Error("fel typ")));
const seen: URL[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  seen.length = 0;
});

function stub(perms: { permission: string; status: string }[] | null) {
  vi.stubGlobal("fetch", async (input: URL | string) => {
    const url = new URL(String(input));
    seen.push(url);
    if (url.pathname.endsWith("/me")) return json(200, { id: "42", name: "Rapportplattform" });
    if (url.pathname.endsWith("/me/permissions")) return perms ? json(200, { data: perms }) : json(400, { error: { message: "Unsupported", code: 100 } });
    return json(404, {});
  });
}

describe("Meta-token", () => {
  it("godkänns med ads_read och sparar ingen hemlighet i etiketten", async () => {
    stub([{ permission: "ads_read", status: "granted" }]);
    const r = await validate(" abc ");
    expect(r.label).toBe("Rapportplattform (systemanvändare)");
    expect(r.tokens.accessToken).toBe("abc");
  });

  it("nekas om ads_read saknas", async () => {
    stub([{ permission: "pages_show_list", status: "granted" }]);
    await expect(validate("abc")).rejects.toBeInstanceOf(ConnectorAuthError);
  });

  it("godkänns om behörighetslistan inte går att läsa (kontrollen mot /me räcker)", async () => {
    stub(null);
    await expect(validate("abc")).resolves.toBeTruthy();
  });

  it("skickar appsecret_proof bara när META_APP_SECRET är satt", async () => {
    stub([{ permission: "ads_read", status: "granted" }]);
    vi.stubEnv("META_APP_SECRET", "");
    await validate("abc");
    expect(seen.every((u) => !u.searchParams.has("appsecret_proof"))).toBe(true);
    seen.length = 0;
    vi.stubEnv("META_APP_SECRET", "hemlig");
    await validate("abc");
    expect(seen.every((u) => /^[0-9a-f]{64}$/.test(u.searchParams.get("appsecret_proof") ?? ""))).toBe(true);
  });
});
