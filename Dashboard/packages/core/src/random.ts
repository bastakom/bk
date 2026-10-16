/** Deterministisk PRNG (mulberry32) så att mockdata blir stabil mellan anrop. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number | string) {
  let a = typeof seed === "string" ? hashString(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normalfördelat brus via Box–Muller. */
export function gaussian(r: () => number): number {
  const u = Math.max(r(), 1e-9);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Fördelar ett heltal på vikter så att delarna summerar exakt till `total`
 * (största-rest-metoden).
 */
export function splitInteger(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0 || total === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (w / sum) * total);
  const floored = raw.map(Math.floor);
  let rest = total - floored.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rest <= 0) break;
    floored[i]! += 1;
    rest--;
  }
  return floored;
}

/**
 * Som splitInteger men för små tal: varje enhet hamnar slumpmässigt efter vikt.
 * Ger realistiska små värden i små segment i stället för att allt avrundas till
 * det största segmentet.
 */
export function sampleInteger(total: number, weights: number[], r: () => number): number[] {
  if (total >= 200) return splitInteger(total, weights);
  const sum = weights.reduce((a, b) => a + b, 0);
  const out = weights.map(() => 0);
  if (sum === 0) return out;
  for (let k = 0; k < total; k++) {
    let x = r() * sum;
    let i = 0;
    while (i < weights.length - 1 && x >= weights[i]!) x -= weights[i++]!;
    out[i]! += 1;
  }
  return out;
}
