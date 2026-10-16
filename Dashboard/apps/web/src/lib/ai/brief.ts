/** Kundprofil för AI-analysen (inriktning, målgrupp, erbjudande). Mätbara mål och budget finns i client_goals. Visas aldrig för kunden. */
import { z } from "zod";

export const GOALS = [
  { id: "leads", label: "Leads" },
  { id: "sales", label: "Försäljning (e-handel)" },
  { id: "traffic", label: "Trafik" },
  { id: "awareness", label: "Varumärke och räckvidd" },
  { id: "engagement", label: "Engagemang" },
  { id: "recruitment", label: "Rekrytering" },
  { id: "store_visits", label: "Butiksbesök" },
  { id: "other", label: "Annat" },
] as const;

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);

export const briefSchema = z.object({
  goal: z.enum(GOALS.map((g) => g.id) as [string, ...string[]]).optional(),
  /** Vem ska nås: ålder, kön, intressen, yrken, livssituation … */
  audience: text(1500),
  /** Marknader och geografi */
  markets: text(300),
  /** Erbjudande, USP, säsong */
  offer: text(1000),
  /** Övrigt: kampanjperioder, begränsningar, tonalitet … */
  notes: text(2000),
});
export type Brief = Partial<z.infer<typeof briefSchema>>;

export function parseBrief(raw: unknown): Brief {
  const r = briefSchema.safeParse(raw ?? {});
  return r.success ? r.data : {};
}

export const briefIsEmpty = (b: Brief) => !b.goal && !b.audience && !b.markets && !b.offer && !b.notes;
