import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectorAuthError, friendlyError, type TokenSet } from "../src";
import { classifyGoogleAdsError, GoogleAdsAccessError, googleAdsConnector as ads } from "../src/connectors/google-ads";

/** Så svarar Google Ads API när projektets åtkomstnivå (Test) används mot ett riktigt konto. */
const notApproved = [
  {
    error: {
      code: 403,
      message: "The caller does not have permission",
      status: "PERMISSION_DENIED",
      details: [
        {
          "@type": "type.googleapis.com/google.ads.googleads.v25.errors.GoogleAdsFailure",
          errors: [{ errorCode: { authorizationError: "DEVELOPER_TOKEN_NOT_APPROVED" }, message: "The developer token is only approved for use with test accounts. To access non-test accounts, apply for Basic or Standard access." }],
        },
      ],
    },
  },
];
const userDenied = { error: { code: 403, status: "PERMISSION_DENIED", details: [{ errors: [{ errorCode: { authorizationError: "USER_PERMISSION_DENIED" } }] }] } };
const tokens: TokenSet = { accessToken: "x", refreshToken: "y", expiresAt: Date.now() + 3_600_000 };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("Google Ads-fel vid åtkomstnivå Test", () => {
  it("känner igen felkoder och ger svenska meddelanden", () => {
    expect(classifyGoogleAdsError(notApproved)?.code).toBe("access_level");
    expect(classifyGoogleAdsError({ error: { details: [{ errors: [{ errorCode: { requestError: "DEVELOPER_TOKEN_PARAMETER_MISSING" } }] }] } })?.code).toBe("developer_token");
    expect(classifyGoogleAdsError({ error: { details: [{ errors: [{ errorCode: { authorizationError: "CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION" } }] }] } })?.code).toBe("access_level");
    expect(classifyGoogleAdsError(userDenied)).toBeNull();
  });

  it("listning av konton ger åtkomstfelet i stället för 0 konton", async () => {
    vi.stubGlobal("fetch", async (url: string) => (String(url).includes("listAccessibleCustomers") ? json(200, { resourceNames: ["customers/1234567890"] }) : json(403, notApproved)));
    await expect(ads.listAccounts({ tokens })).rejects.toBeInstanceOf(GoogleAdsAccessError);
  });

  it("synk mot riktigt konto blir synkfel med förklaring, inte 'koppla om'", async () => {
    vi.stubGlobal("fetch", async () => json(403, notApproved));
    const err = await ads.fetch({ tokens }, { account: { externalId: "123-456-7890", name: "K", currency: "SEK" }, metrics: ["spend"], dimensions: [], dateRange: { start: "2026-10-01", end: "2026-10-07" } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GoogleAdsAccessError);
    expect(err).not.toBeInstanceOf(ConnectorAuthError);
    expect(friendlyError((err as Error).message)?.text).toMatch(/åtkomstnivån Explorer/);
  });

  it("annat 403 (användaren saknar åtkomst) hanteras som förut", async () => {
    vi.stubGlobal("fetch", async () => json(403, userDenied));
    const err = await ads.fetch({ tokens }, { account: { externalId: "123-456-7890", name: "K", currency: "SEK" }, metrics: ["spend"], dimensions: [], dateRange: { start: "2026-10-01", end: "2026-10-07" } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectorAuthError);
  });
});
