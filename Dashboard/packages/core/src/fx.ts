/**
 * Valutaomräkning med ECB:s dagliga referenskurser (EUR som bas).
 * Helger och helgdagar saknar kurs – då används senast publicerade kurs
 * före datumet (eller första kända kurs om datumet ligger före all data).
 */

export interface FxPoint {
  /** YYYY-MM-DD */
  date: string;
  /** ISO 4217 */
  currency: string;
  /** Antal enheter av `currency` per 1 EUR */
  perEur: number;
}

export class FxTable {
  private series = new Map<string, { dates: string[]; rates: number[] }>();

  constructor(points: FxPoint[]) {
    const byCur = new Map<string, FxPoint[]>();
    for (const p of points) byCur.set(p.currency, [...(byCur.get(p.currency) ?? []), p]);
    for (const [cur, ps] of byCur) {
      ps.sort((a, b) => (a.date < b.date ? -1 : 1));
      this.series.set(cur, { dates: ps.map((p) => p.date), rates: ps.map((p) => p.perEur) });
    }
  }

  has(currency: string) {
    return currency === "EUR" || this.series.has(currency);
  }

  /** Enheter av `currency` per EUR på datumet (senast kända kurs). */
  perEur(currency: string, date: string): number | null {
    if (currency === "EUR") return 1;
    const s = this.series.get(currency);
    if (!s || s.dates.length === 0) return null;
    // Binärsökning efter sista datum <= date
    let lo = 0;
    let hi = s.dates.length - 1;
    if (date < s.dates[0]!) return s.rates[0]!;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (s.dates[mid]! <= date) lo = mid;
      else hi = mid - 1;
    }
    return s.rates[lo]!;
  }

  /** Faktor att multiplicera ett belopp i `from` med för att få `to`. */
  rate(from: string, to: string, date: string): number | null {
    if (from === to) return 1;
    const f = this.perEur(from, date);
    const t = this.perEur(to, date);
    return f && t ? t / f : null;
  }
}
