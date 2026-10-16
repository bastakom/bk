/**
 * Delad Google OAuth för GA4 och Google Ads (samma OAuth-klient i Google
 * Cloud, olika scopes per connector). Adresser kan pekas om till den
 * simulerade servern via miljövariabler.
 */
import { retryAfterMs } from "../http";
import { ConnectorAuthError, ConnectorRetryableError, type OAuthConfig, type TokenSet } from "../types";

export function googleCfg() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    authUrl: `${process.env.GOOGLE_AUTH_BASE ?? "https://accounts.google.com"}/o/oauth2/v2/auth`,
    tokenUrl: process.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token",
  };
}

interface GoogleError {
  error?: { code?: number; status?: string; message?: string; details?: unknown[] } | string;
  error_description?: string;
}

/** Översätter Googles fel till connector-fel som sync-lagret förstår. */
export async function checkGoogle(res: Response, what: string): Promise<Response> {
  if (res.ok) return res;
  const body = (await res.json().catch(() => ({}))) as GoogleError | GoogleError[];
  const first = Array.isArray(body) ? body[0] ?? {} : body;
  const e = typeof first.error === "object" ? first.error : undefined;
  const msg = e?.message ?? first.error_description ?? (typeof first.error === "string" ? first.error : res.statusText);
  if (res.status === 403) throw new ConnectorAuthError(`Inloggningen saknar åtkomst (${what}): ${msg}`, "account", "no_access");
  if (first.error === "invalid_grant") throw new ConnectorAuthError(`Google-behörigheten har återkallats: ${msg}`, "connection", "revoked");
  if (res.status === 401) throw new ConnectorAuthError(`Googles access token är ogiltig: ${msg}`, "connection", "expired");
  if (res.status === 429 || res.status >= 500 || e?.status === "RESOURCE_EXHAUSTED") {
    throw new ConnectorRetryableError(`Google svarade ${res.status} (${what}): ${msg}`, retryAfterMs(res.headers.get("retry-after")) ?? (res.status === 429 ? 60_000 : undefined));
  }
  throw new Error(`Google svarade ${res.status} (${what}): ${msg}`);
}

async function tokenRequest(params: Record<string, string>): Promise<TokenSet> {
  const c = googleCfg();
  const res = await fetch(c.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...params }),
    signal: AbortSignal.timeout(20_000),
  });
  await checkGoogle(res, "token");
  const t = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string; id_token?: string };
  // E-postadressen läses ur id_token (hämtad direkt från Google över TLS, därför ingen signaturkontroll här).
  let email: string | undefined;
  try {
    email = t.id_token ? (JSON.parse(Buffer.from(t.id_token.split(".")[1]!, "base64url").toString()) as { email?: string }).email : undefined;
  } catch {
    email = undefined;
  }
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? params.refresh_token,
    expiresAt: Date.now() + (t.expires_in ?? 3600) * 1000,
    scope: t.scope,
    extra: email ? { email } : undefined,
  };
}

/** OAuth-konfiguration för en Google-connector med givna scopes. */
export function googleOAuth(scopes: string[]): OAuthConfig {
  return {
    type: "oauth2",
    scopes,
    getAuthorizationUrl({ state, redirectUri }) {
      const q = new URLSearchParams({
        client_id: googleCfg().clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes.join(" "),
        state,
        // offline + consent ger en refresh token så att synken kan köra utan användaren.
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
      });
      return `${googleCfg().authUrl}?${q}`;
    },
    exchangeCode: ({ code, redirectUri }) => tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    async refresh(tokens) {
      if (!tokens.refreshToken) throw new ConnectorAuthError("Ingen refresh token – koppla om Google-kontot.");
      const fresh = await tokenRequest({ refresh_token: tokens.refreshToken, grant_type: "refresh_token" });
      return { ...fresh, extra: { ...tokens.extra, ...fresh.extra } };
    },
  };
}
