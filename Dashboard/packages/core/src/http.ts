/**
 * Gemensamma byggstenar för connectors som pratar med externa API:er:
 * omförsök med exponentiell backoff och en enkel hastighetsbegränsare.
 */
import { ConnectorAuthError, ConnectorRetryableError } from "./types";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface RetryOptions {
  /** Antal omförsök efter första försöket. */
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (info: { attempt: number; waitMs: number; error: unknown }) => void;
}

/** Nätverksfel (DNS, avbruten anslutning) räknas som tillfälliga. */
function isRetryable(err: unknown): boolean {
  if (err instanceof ConnectorAuthError) return false;
  if (err instanceof ConnectorRetryableError) return true;
  return err instanceof TypeError && /fetch failed|network|socket|ECONN/i.test(`${err.message} ${(err as { cause?: { code?: string } }).cause?.code ?? ""}`);
}

/**
 * Kör `fn` med omförsök vid tillfälliga fel. Väntetiden växer exponentiellt
 * med "full jitter" så att många samtidiga synkar inte slår i API:et i takt,
 * och respekterar serverns Retry-After när den finns.
 */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { retries = 4, baseMs = 1000, maxMs = 60_000, sleep: wait = sleep } = opts;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= retries || !isRetryable(err)) throw err;
      const backoff = Math.random() * Math.min(maxMs, baseMs * 2 ** attempt);
      const waitMs = Math.min(maxMs, Math.max(backoff, err instanceof ConnectorRetryableError ? (err.retryAfterMs ?? 0) : 0));
      opts.onRetry?.({ attempt: attempt + 1, waitMs, error: err });
      await wait(waitMs);
    }
  }
}

/**
 * Begränsar samtidiga anrop och minsta tid mellan anrop för en API-leverantör.
 * Delas av alla kunder i processen – kvoter gäller ofta appen totalt.
 */
export class RateLimiter {
  private active = 0;
  private queue: (() => void)[] = [];
  private last = 0;

  constructor(
    private readonly concurrency: number,
    private readonly minIntervalMs = 0,
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) await new Promise<void>((r) => this.queue.push(r));
    this.active++;
    try {
      const wait = this.last + this.minIntervalMs - Date.now();
      this.last = Math.max(Date.now(), this.last + this.minIntervalMs);
      if (wait > 0) await sleep(wait);
      return await fn();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
}

/** Retry-After i sekunder eller som HTTP-datum → millisekunder. */
export function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const s = Number(header);
  if (Number.isFinite(s)) return s * 1000;
  const t = Date.parse(header);
  return Number.isFinite(t) ? Math.max(0, t - Date.now()) : undefined;
}
