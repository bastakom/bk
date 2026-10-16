/**
 * Hämtar ECB:s dagliga referenskurser och sparar dem i fx_rates.
 * Körs av seed och (från fas 5) som schemalagt jobb varje vardag efter 16:00 CET.
 */
import { FxTable } from "@rp/core";
import type { PrismaClient } from "./generated/prisma/client";
import type { TenantTx } from "./index";

export const SUPPORTED_CURRENCIES = ["SEK", "USD", "NOK", "DKK", "GBP"] as const;

const ECB_URL = (from: string) =>
  `https://data-api.ecb.europa.eu/service/data/EXR/D.${SUPPORTED_CURRENCIES.join("+")}.EUR.SP00.A?format=csvdata&detail=dataonly&startPeriod=${from}`;

export async function fetchEcbRates(from: string): Promise<{ currency: string; date: string; perEur: number }[]> {
  const res = await fetch(ECB_URL(from), { headers: { Accept: "text/csv" }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`ECB svarade ${res.status}`);
  const [header, ...lines] = (await res.text()).trim().split(/\r?\n/);
  const cols = header!.split(",");
  const iCur = cols.indexOf("CURRENCY");
  const iDate = cols.indexOf("TIME_PERIOD");
  const iVal = cols.indexOf("OBS_VALUE");
  return lines
    .map((l) => l.split(","))
    .map((c) => ({ currency: c[iCur]!, date: c[iDate]!, perEur: Number(c[iVal]) }))
    .filter((r) => r.currency && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(r.perEur) && r.perEur > 0);
}

/** Hämtar kurser från `from` och sparar dem. Returnerar antal sparade rader. */
export async function syncFxRates(prisma: PrismaClient, from: string): Promise<number> {
  const rates = await fetchEcbRates(from);
  for (let i = 0; i < rates.length; i += 1000) {
    const batch = rates.slice(i, i + 1000);
    await prisma.$transaction(
      batch.map((r) =>
        prisma.fxRate.upsert({
          where: { currency_date: { currency: r.currency, date: new Date(r.date) } },
          create: { currency: r.currency, date: new Date(r.date), perEur: r.perEur },
          update: { perEur: r.perEur },
        }),
      ),
    );
  }
  return rates.length;
}

/** Läser kurser för en period (med marginal bakåt för helger) till en FxTable. */
export async function loadFxTable(tx: TenantTx, from: string, to: string): Promise<FxTable> {
  const start = new Date(from);
  start.setUTCDate(start.getUTCDate() - 10);
  const rows = await tx.fxRate.findMany({ where: { date: { gte: start, lte: new Date(to) } }, select: { currency: true, date: true, perEur: true } });
  // Saknas kurser i fönstret (t.ex. framtida datum): ta senaste kända per valuta.
  const latest = await tx.fxRate.findMany({ where: { date: { lt: start } }, orderBy: { date: "desc" }, distinct: ["currency"], select: { currency: true, date: true, perEur: true } });
  return new FxTable([...latest, ...rows].map((r) => ({ currency: r.currency, date: r.date.toISOString().slice(0, 10), perEur: r.perEur })));
}
