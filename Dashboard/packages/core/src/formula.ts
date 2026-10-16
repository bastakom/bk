/**
 * Formler för egna "blended" metrics, t.ex.
 *   conversion_value / spend                 (total ROAS över alla valda källor)
 *   spend / sessions[ga4]                    (kostnad per besök: all spend delat med GA4-besök)
 *   (clicks[google_ads] + clicks[meta_ads]) / sessions[ga4]
 *
 * Formeln tolkas till ett syntaxträd (ingen eval) och räknas alltid på
 * SUMMOR för perioden/bucketen – aldrig som medelvärde av dagliga kvoter.
 */
import { METRICS } from "./metrics";
import { PLATFORMS } from "./platforms";
import type { MetricId, PlatformId } from "./types";

export type FormulaNode =
  | { kind: "num"; value: number }
  | { kind: "ref"; metric: MetricId; platform?: PlatformId }
  | { kind: "neg"; arg: FormulaNode }
  | { kind: "bin"; op: "+" | "-" | "*" | "/"; left: FormulaNode; right: FormulaNode };

export class FormulaError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message);
  }
}

type Token = { t: "num"; v: number; p: number } | { t: "id"; v: string; p: number } | { t: "op"; v: string; p: number };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.,]/.test(c)) {
      const start = i;
      while (i < src.length && /[0-9.,]/.test(src[i]!)) i++;
      const raw = src.slice(start, i).replace(",", ".");
      const v = Number(raw);
      if (!Number.isFinite(v)) throw new FormulaError(`Ogiltigt tal "${raw}"`, start);
      out.push({ t: "num", v, p: start });
    } else if (/[a-zA-Z_]/.test(c)) {
      const start = i;
      while (i < src.length && /[a-zA-Z0-9_]/.test(src[i]!)) i++;
      out.push({ t: "id", v: src.slice(start, i).toLowerCase(), p: start });
    } else if ("+-*/()[]".includes(c)) {
      out.push({ t: "op", v: c, p: i++ });
    } else {
      throw new FormulaError(`Okänt tecken "${c}"`, i);
    }
  }
  return out;
}

export function parseFormula(src: string): FormulaNode {
  if (!src.trim()) throw new FormulaError("Formeln är tom", 0);
  if (src.length > 500) throw new FormulaError("Formeln är för lång", 500);
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const at = () => peek()?.p ?? src.length;
  const expectOp = (v: string) => {
    const tk = peek();
    if (tk?.t !== "op" || tk.v !== v) throw new FormulaError(`Förväntade "${v}"`, at());
    pos++;
  };

  function expr(): FormulaNode {
    let left = term();
    for (let tk = peek(); tk?.t === "op" && (tk.v === "+" || tk.v === "-"); tk = peek()) {
      pos++;
      left = { kind: "bin", op: tk.v as "+" | "-", left, right: term() };
    }
    return left;
  }
  function term(): FormulaNode {
    let left = factor();
    for (let tk = peek(); tk?.t === "op" && (tk.v === "*" || tk.v === "/"); tk = peek()) {
      pos++;
      left = { kind: "bin", op: tk.v as "*" | "/", left, right: factor() };
    }
    return left;
  }
  function factor(): FormulaNode {
    const tk = peek();
    if (!tk) throw new FormulaError("Formeln slutar för tidigt", src.length);
    if (tk.t === "num") {
      pos++;
      return { kind: "num", value: tk.v };
    }
    if (tk.t === "op" && tk.v === "-") {
      pos++;
      return { kind: "neg", arg: factor() };
    }
    if (tk.t === "op" && tk.v === "(") {
      pos++;
      const e = expr();
      expectOp(")");
      return e;
    }
    if (tk.t === "id") {
      pos++;
      if (!(tk.v in METRICS)) throw new FormulaError(`Okänd metric "${tk.v}"`, tk.p);
      const node: FormulaNode = { kind: "ref", metric: tk.v as MetricId };
      const next = peek();
      if (next?.t === "op" && next.v === "[") {
        pos++;
        const p = peek();
        if (p?.t !== "id" || !(p.v in PLATFORMS)) throw new FormulaError(`Okänd källa – använd ${Object.keys(PLATFORMS).join(", ")}`, at());
        node.platform = p.v as PlatformId;
        pos++;
        expectOp("]");
      }
      return node;
    }
    throw new FormulaError(`Oväntat "${tk.v}"`, tk.p);
  }

  const tree = expr();
  if (pos < tokens.length) throw new FormulaError(`Oväntat "${tokens[pos]!.v}"`, tokens[pos]!.p);
  return tree;
}

/** Alla metric-referenser i formeln. */
export function formulaRefs(node: FormulaNode): { metric: MetricId; platform?: PlatformId }[] {
  switch (node.kind) {
    case "num":
      return [];
    case "ref":
      return [{ metric: node.metric, platform: node.platform }];
    case "neg":
      return formulaRefs(node.arg);
    case "bin":
      return [...formulaRefs(node.left), ...formulaRefs(node.right)];
  }
}

/** Räknar ut formeln. `lookup` ger värdet för en referens eller null om data saknas. */
export function evaluateFormula(node: FormulaNode, lookup: (metric: MetricId, platform?: PlatformId) => number | null): number | null {
  switch (node.kind) {
    case "num":
      return node.value;
    case "ref":
      return lookup(node.metric, node.platform);
    case "neg": {
      const v = evaluateFormula(node.arg, lookup);
      return v === null ? null : -v;
    }
    case "bin": {
      const l = evaluateFormula(node.left, lookup);
      const r = evaluateFormula(node.right, lookup);
      if (l === null || r === null) return null;
      switch (node.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return r === 0 ? null : l / r;
      }
    }
  }
}

/** Formel som läsbar svensk text, t.ex. "Spend / Besök (GA4)". */
export function describeFormula(node: FormulaNode, parent?: FormulaNode["kind"]): string {
  switch (node.kind) {
    case "num":
      return node.value.toLocaleString("sv-SE");
    case "ref":
      return `${METRICS[node.metric].label}${node.platform ? ` (${PLATFORMS[node.platform].label})` : ""}`;
    case "neg":
      return `−${describeFormula(node.arg, "neg")}`;
    case "bin": {
      const s = `${describeFormula(node.left, "bin")} ${node.op === "*" ? "×" : node.op === "/" ? "/" : node.op === "-" ? "−" : "+"} ${describeFormula(node.right, "bin")}`;
      return parent === "bin" ? `(${s})` : s;
    }
  }
}
