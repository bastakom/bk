/**
 * Synkar ett kopplat konto: hämtar data från connectorn och skriver
 * normaliserade fakta till metric_facts. Används av seed, "Synka nu",
 * OAuth-callbacken och workerns schemalagda synk.
 *
 * Nätverksanrop görs utanför databastransaktioner (riktiga API:er kan ta
 * minuter); varje skrivning sker i en egen kort transaktion via `db`.
 */
import { ConnectorAuthError, addDays, mergeDuplicateRows, todayInTimezone, type DimensionId, type TokenSet } from "@rp/core";
import { decryptSecret, encryptSecret, getConnector } from "@rp/core/server";
import type { AccountStatus, PrismaClient } from "./generated/prisma/client";
import type { TenantTx } from "./index";

/** Kör en databasoperation: tenant-bunden i appen, ägarroll i workern. */
export type DbRunner = <T>(fn: (tx: TenantTx) => Promise<T>) => Promise<T>;

/** DbRunner för ägarklienten (seed och systemjobb). */
export const ownerRunner =
  (client: PrismaClient): DbRunner =>
  (fn) =>
    fn(client);

export interface SyncOptions {
  /**
   * Antal dagar bakåt. Standard: ~3 år vid första synken (så att "förra året"
   * har ett helt jämförelseår), annars SYNC_LOOKBACK_DAYS (7) – plattformarna
   * justerar ofta de senaste dagarnas siffror i efterhand.
   */
  days?: number;
  /** Vilka dimensioner som ska synkas utöver dagstotaler (default: alla connectorn stöder). */
  dimensions?: DimensionId[];
}

export interface SyncResult {
  ok: boolean;
  rowsWritten: number;
  error?: string;
  auth?: boolean;
  previousStatus: AccountStatus;
  status: AccountStatus;
}

const CHUNK = 2000;
/** Förnya access token om den går ut inom 5 minuter. */
const REFRESH_MARGIN_MS = 5 * 60_000;

export async function syncAccount(db: DbRunner | TenantTx, accountId: string, opts: SyncOptions = {}): Promise<SyncResult> {
  const run: DbRunner = typeof db === "function" ? db : (fn) => fn(db);
  const account = await run((tx) => tx.connectedAccount.findUniqueOrThrow({ where: { id: accountId }, include: { connection: true } }));
  const connector = getConnector(account.connectorId);
  const previousStatus = account.status;
  const days = opts.days ?? (account.lastSyncedAt ? Number(process.env.SYNC_LOOKBACK_DAYS ?? 7) : 1100);
  const end = todayInTimezone(account.timezone);
  const range = { start: addDays(end, -(days - 1)), end };

  const syncRun = await run(async (tx) => {
    await tx.connectedAccount.update({ where: { id: accountId }, data: { lastSyncAttemptAt: new Date() } });
    return tx.syncRun.create({
      data: { workspaceId: account.workspaceId, accountId, rangeStart: new Date(range.start), rangeEnd: new Date(range.end) },
    });
  });

  const external = { externalId: account.externalId, name: account.name, currency: account.currency, timezone: account.timezone };

  /** Hämtar alla dimensioner och ersätter periodens fakta. Returnerar antal skrivna rader. */
  async function fetchAndStore(tokens: TokenSet): Promise<number> {
    const ctx = { tokens };
    const metrics = connector.availableMetrics();
    const dims = opts.dimensions ?? connector.availableDimensions().filter((d) => d !== "date");
    let written = 0;
    for (const dim of [undefined, ...dims]) {
      const res = await connector.fetch(ctx, { account: external, metrics, dimensions: dim ? [dim] : [], dateRange: range });
      // Flera plattformsrader kan bli samma värde efter normalisering; summera dem (unik nyckel i metric_facts).
      const data = mergeDuplicateRows(res.rows).map((r) => ({
        workspaceId: account.workspaceId,
        accountId,
        date: new Date(r.date),
        dimension: dim ?? "",
        dimensionValue: dim ? (r.dims[dim] ?? "(saknas)") : "",
        currency: res.currency,
        metrics: r.metrics,
      }));
      // Ersätt perioden för dimensionen atomiskt: läsare ser antingen gammal eller ny data.
      written += await run(async (tx) => {
        await tx.metricFact.deleteMany({ where: { accountId, dimension: dim ?? "", date: { gte: new Date(range.start), lte: new Date(range.end) } } });
        let n = 0;
        for (let i = 0; i < data.length; i += CHUNK) n += (await tx.metricFact.createMany({ data: data.slice(i, i + CHUNK) })).count;
        return n;
      });
    }
    if (connector.fetchCreatives) {
      const creatives = await connector.fetchCreatives(ctx, external);
      // Ladda ner bilder som är nya eller har bytts (utanför transaktionen; nätverk kan ta tid).
      const stored = await run((tx) => tx.creative.findMany({ where: { accountId }, select: { externalId: true, imageSource: true, imageType: true } }));
      const have = new Map(stored.map((c) => [c.externalId, c]));
      const images = new Map<string, { data: Uint8Array<ArrayBuffer>; type: string; source: string }>();
      await mapLimit(creatives, 4, async (c) => {
        const source = c.thumbnailUrl ? imageSourceKey(c.thumbnailUrl) : undefined;
        const prev = have.get(c.externalId);
        if (!source || (prev?.imageSource === source && prev.imageType)) return;
        const img = await downloadImage(c.thumbnailUrl!);
        if (img) images.set(c.externalId, { ...img, source });
      });
      await run(async (tx) => {
        for (const c of creatives) {
          const img = images.get(c.externalId);
          const data = {
            name: c.name,
            headline: c.headline,
            text: c.text,
            thumbnailUrl: c.thumbnailUrl,
            format: c.format,
            campaign: c.campaign,
            permalink: c.permalink,
            mediaRef: c.mediaRef,
            ...(img ? { imageData: img.data, imageType: img.type, imageSource: img.source } : {}),
          };
          await tx.creative.upsert({
            where: { accountId_externalId: { accountId, externalId: c.externalId } },
            create: { ...data, workspaceId: account.workspaceId, accountId, externalId: c.externalId },
            update: data,
          });
        }
      });
    }
    return written;
  }

  const persistTokens = async (tokens: TokenSet) => {
    const encrypted = encryptSecret(JSON.stringify(tokens));
    await run((tx) => tx.connection.update({ where: { id: account.connectionId }, data: { encryptedTokens: encrypted, status: "ACTIVE" } }));
  };

  try {
    // Behörighet: förnya token om den snart går ut och spara den nya krypterat.
    let tokens = JSON.parse(decryptSecret(account.connection.encryptedTokens)) as TokenSet;
    const oauth = connector.auth.type === "oauth2" && !connector.isMock ? connector.auth : null;
    if (oauth && tokens.expiresAt && tokens.expiresAt < Date.now() + REFRESH_MARGIN_MS) {
      tokens = await oauth.refresh(tokens);
      await persistTokens(tokens);
    }

    let written: number;
    try {
      written = await fetchAndStore(tokens);
    } catch (err) {
      // Token kan bli ogiltig före sitt utgångsdatum: förnya en gång och försök igen.
      if (!(err instanceof ConnectorAuthError) || err.reason !== "expired" || !oauth) throw err;
      tokens = await oauth.refresh(tokens);
      await persistTokens(tokens);
      written = await fetchAndStore(tokens);
    }

    await run(async (tx) => {
      await tx.syncRun.update({ where: { id: syncRun.id }, data: { status: "SUCCESS", rowsWritten: written, finishedAt: new Date() } });
      await tx.connectedAccount.update({ where: { id: accountId }, data: { status: "OK", statusMessage: null, lastSyncedAt: new Date() } });
    });
    return { ok: true, rowsWritten: written, previousStatus, status: "OK" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const auth = err instanceof ConnectorAuthError;
    const status: AccountStatus = auth ? "AUTH_REQUIRED" : "SYNC_ERROR";
    await run(async (tx) => {
      await tx.syncRun.update({ where: { id: syncRun.id }, data: { status: "FAILED", error: message, finishedAt: new Date() } });
      await tx.connectedAccount.update({ where: { id: accountId }, data: { status, statusMessage: message } });
      // Återkallad inloggning gäller alla konton som använder den (riktiga connectors).
      if (auth && err.scope === "connection" && !connector.isMock) {
        await tx.connection.update({ where: { id: account.connectionId }, data: { status: "AUTH_REQUIRED" } });
        await tx.connectedAccount.updateMany({ where: { connectionId: account.connectionId }, data: { status: "AUTH_REQUIRED", statusMessage: message } });
      }
    });
    return { ok: false, rowsWritten: 0, error: message, auth, previousStatus, status };
  }
}

/** Bildens identitet utan signatur/utgång i frågesträngen (Metas länkar signeras om vid varje anrop). */
export function imageSourceKey(url: string): string {
  if (url.startsWith("data:")) return url.slice(0, 200);
  try {
    const u = new URL(url);
    // Metas proxy för externa bilder bär den verkliga bildens adress i "url".
    return `${u.host}${u.pathname}${u.searchParams.get("url") ? `?url=${u.searchParams.get("url")}` : ""}`;
  } catch {
    return url;
  }
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Hämtar en bild (best effort). Null om den inte går att hämta eller inte är en bild. */
async function downloadImage(url: string): Promise<{ data: Uint8Array<ArrayBuffer>; type: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim();
    if (!res.ok || !type.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength > 0 && buf.byteLength <= MAX_IMAGE_BYTES ? { data: buf, type } : null;
  } catch {
    return null;
  }
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]!);
  }));
}
