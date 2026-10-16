/**
 * AI-analys av en dashboard (internt): vad som går bra, vad som kan bli bättre och
 * konkreta nästa steg för byråns performance marketer.
 *
 * Underlaget byggs med samma dataladdning som dashboarden (filter, kundens källfilter
 * och valutaomräkning gäller), och skickas till Claude tillsammans med kundens brief
 * och annonsbilderna. Svaret kommer som strukturerad JSON via ett verktygsanrop.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  DIMENSIONS,
  formatDelta,
  formatMetric,
  formatRange,
  GOAL_PERIODS,
  GOAL_STATUS_LABEL,
  PLATFORMS,
  widgetConfigSchema,
  type BreakdownResult,
  type DimensionId,
  type KpiResult,
  type MetricId,
  type PlatformId,
  type WidgetType,
} from "@rp/core";
import type { TenantTx } from "@rp/db";
import { z } from "zod";
import { loadWidgetData, type AccountInfo, type DataContext } from "../dashboard-data";
import type { GoalProgress } from "../goals";
import { GOALS, type Brief } from "./brief";

export const AI_MODEL = () => process.env.AI_MODEL ?? "claude-opus-5-5";
export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

// ─── Resultatets form ───────────────────────────────────────────────────────

const point = z.object({ title: z.string(), detail: z.string(), evidence: z.string().optional() });
export const insightSchema = z.object({
  headline: z.string(),
  status: z.enum(["bra", "blandat", "behöver åtgärd"]),
  summary: z.string(),
  whatWorks: z.array(point),
  improvements: z.array(point.extend({ priority: z.enum(["hög", "medel", "låg"]) })),
  audience: z.object({ fit: z.enum(["god", "delvis", "svag", "okänd"]), assessment: z.string(), findings: z.array(point) }),
  creatives: z.array(z.object({ ad: z.string(), verdict: z.string(), suggestion: z.string() })),
  actions: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      priority: z.enum(["hög", "medel", "låg"]),
      effort: z.enum(["liten", "medel", "stor"]),
      timeframe: z.enum(["denna vecka", "denna månad", "nästa kvartal"]),
    }),
  ),
  budget: z.string(),
  dataGaps: z.array(z.string()),
});
export type Insight = z.infer<typeof insightSchema>;

const str = { type: "string" } as const;
const pointJson = { type: "object", properties: { title: str, detail: str, evidence: { type: "string", description: "Siffrorna som stödjer punkten" } }, required: ["title", "detail"] };
const priority = { type: "string", enum: ["hög", "medel", "låg"] };
const TOOL: Anthropic.Tool = {
  name: "lamna_analys",
  description: "Lämna den färdiga analysen till byråns team.",
  input_schema: {
    type: "object",
    properties: {
      headline: { type: "string", description: "En mening: hur går det, och det viktigaste att göra." },
      status: { type: "string", enum: ["bra", "blandat", "behöver åtgärd"] },
      summary: { type: "string", description: "3–5 meningar om perioden mot målen." },
      whatWorks: { type: "array", items: pointJson, description: "Det som fungerar, med siffror." },
      improvements: { type: "array", items: { ...pointJson, properties: { ...pointJson.properties, priority }, required: ["title", "detail", "priority"] } },
      audience: {
        type: "object",
        properties: {
          fit: { type: "string", enum: ["god", "delvis", "svag", "okänd"] },
          assessment: { ...str, description: "Når annonserna rätt målgrupp enligt briefen? Bygg på ålder, kön, region, enhet, yrken m.m." },
          findings: { type: "array", items: pointJson },
        },
        required: ["fit", "assessment", "findings"],
      },
      creatives: {
        type: "array",
        items: { type: "object", properties: { ad: str, verdict: str, suggestion: str }, required: ["ad", "verdict", "suggestion"] },
        description: "Bedömning av annonserna (bild, budskap, krok, resultat).",
      },
      actions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: str,
            detail: { ...str, description: "Konkret: vad, var (kanal/kampanj) och hur." },
            priority,
            effort: { type: "string", enum: ["liten", "medel", "stor"] },
            timeframe: { type: "string", enum: ["denna vecka", "denna månad", "nästa kvartal"] },
          },
          required: ["title", "detail", "priority", "effort", "timeframe"],
        },
        description: "Nästa steg för performance marketern, prioriterade.",
      },
      budget: { ...str, description: "Takt mot budget och fördelning mellan kanaler/kampanjer." },
      dataGaps: { type: "array", items: str, description: "Vad som saknas för en säkrare analys (spårning, mål, data)." },
    },
    required: ["headline", "status", "summary", "whatWorks", "improvements", "audience", "creatives", "actions", "budget", "dataGaps"],
  },
};

const SYSTEM = `Du är senior performance marketing-strateg på en stor digital byrå och analyserar en kunds kampanjer åt byråns team. Analysen är intern – kunden ser den aldrig – så var rak, konkret och prioriterande.

Så arbetar du:
- Bedöm resultatet mot kundens mål, KPI-mål, budget och målgrupp i briefen. Saknas briefen, säg det och utgå från branschpraxis för kanalen.
- Använd siffrorna. Hänvisa till kanal, kampanj, annonsgrupp och annons med namn och tal (t.ex. "CPA 412 kr mot mål 300 kr, +18 % mot föregående period").
- Skilj på signal och brus: små volymer och korta perioder ger osäkra slutsatser – säg när det gäller.
- Målgrupp: jämför fördelningen på ålder, kön, region, enhet och (LinkedIn) yrkesnivå, bransch och jobbtitel med briefens målgrupp. Peka ut var budgeten läcker till fel målgrupp och var resultaten är bäst.
- Annonser: bedöm bild, budskap, krok och erbjudande mot målgruppen, och koppla till resultaten (CTR, CPA, visningsgrad). För video ser du bara omslagsbilden; bedöm kroken och hur länge tittarna stannar via andelen som ser 25/50/75/100 %.
- GA4 och annonsplattformarna räknar konverteringar olika; summera dem inte som om de vore samma sak.
- Ge åtgärder en performance marketer kan göra direkt: budgetflytt, bud- och målgruppsinställningar, nya kreativa tester, landningssidor, spårning. Prioritera efter effekt och insats. Inga allmänna råd utan koppling till datan.
- Skriv på svenska. Lämna svaret med verktyget lamna_analys.`;

// ─── Underlag ───────────────────────────────────────────────────────────────

const KPI_METRICS: MetricId[] = [
  "spend", "impressions", "clicks", "ctr", "cpc", "cpm", "conversions", "conversion_rate", "cpa", "conversion_value", "roas",
  "sessions", "users", "new_users", "session_engagement_rate", "bounce_rate", "avg_session_duration",
  "engagements", "engagement_rate", "video_views", "video_view_rate", "video_q25", "video_q50", "video_q75", "video_completion_rate",
];
const ROW_METRICS: MetricId[] = ["spend", "impressions", "clicks", "ctr", "conversions", "cpa", "roas", "sessions", "conversion_rate", "video_view_rate", "video_completion_rate"];
const BREAKDOWNS: DimensionId[] = ["campaign", "ad_set", "keyword", "age", "gender", "region", "device", "channel_group", "seniority", "job_title", "industry"];
const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 3_500_000;

export interface InsightInput {
  text: string;
  images: { label: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string }[];
}

/** Bygger underlaget: brief, nyckeltal per källa, uppdelningar och de största annonserna med bilder. */
export async function buildInsightInput(
  tx: TenantTx,
  params: { ctx: DataContext; sources: AccountInfo[]; brief: Brief; goals: GoalProgress[]; clientName: string; dashboardName: string; currency: string },
): Promise<InsightInput> {
  const { ctx, sources, brief, currency } = params;
  const lines: string[] = [];
  const out: InsightInput = { text: "", images: [] };
  const run = (type: WidgetType, accountIds: string[], config: Record<string, unknown>) =>
    loadWidgetData(tx, { type, accountIds, config: widgetConfigSchema.parse({ showComparison: true, ...config }) }, ctx);
  const has = (p: PlatformId, ms: MetricId[]) => ms.filter((m) => ctx.catalog[p]?.metrics.includes(m));

  lines.push(`# ${params.clientName} – ${params.dashboardName}`);
  lines.push(`Period: ${formatRange(ctx.range.range)}${ctx.range.compareRange ? `, jämförs med ${formatRange(ctx.range.compareRange)}` : ""}. Belopp i ${currency}.`);
  lines.push("", "## Kundprofil");
  if (brief.goal) lines.push(`- Inriktning: ${GOALS.find((g) => g.id === brief.goal)?.label}`);
  if (brief.audience) lines.push(`- Målgrupp: ${brief.audience}`);
  if (brief.markets) lines.push(`- Marknader: ${brief.markets}`);
  if (brief.offer) lines.push(`- Erbjudande/USP: ${brief.offer}`);
  if (brief.notes) lines.push(`- Övrigt: ${brief.notes}`);
  if (!Object.values(brief).some(Boolean)) lines.push("- (Ingen kundprofil ifylld)");
  if (params.goals.length) {
    lines.push("", "## Kundens mål och budget (utfall för målperioden hittills)");
    for (const g of params.goals) {
      const f = (v: number | null) => formatMetric(g.meta, v, g.currency ?? currency);
      const e = g.evaluation;
      lines.push(
        `- ${g.label} (${g.metric === "spend" ? "budget" : "mål"} ${GOAL_PERIODS.find((p) => p.id === g.period)?.label}): ${f(g.actual)} av ${f(g.target)} · ${GOAL_STATUS_LABEL[e.status]}` +
          (e.projection !== null ? ` · prognos ${f(e.projection)} · ${Math.round(e.elapsedShare * 100)} % av perioden har gått` : "") +
          ` (${g.window.start}–${g.window.through})`,
      );
    }
  }
  if (ctx.annotations.length) {
    lines.push("", "## Händelser i perioden (byråns anteckningar)");
    for (const a of ctx.annotations) lines.push(`- ${a.date}: ${a.text}${a.internal ? " (intern – nämn inte för kunden)" : ""}`);
  }
  if (ctx.filters.length) lines.push(`- Dashboardens filter: ${ctx.filters.map((f) => `${f.platform ?? "alla"} ${f.dimension} ${f.op} ${f.values.join(", ")}`).join("; ")}`);

  for (const a of sources) {
    const p = a.platform;
    lines.push("", `## ${PLATFORMS[p].label}: ${a.name}`);
    if (a.filters.length) lines.push(`(Kundens del av kontot: ${a.filters.map((f) => `${f.dimension} ${f.op} ${f.values.join(", ")}`).join("; ")})`);

    const kpi = await run("kpi", [a.id], { metrics: has(p, KPI_METRICS) });
    const k = kpi.result?.kind === "kpi" ? (kpi.result as KpiResult) : null;
    if (k) {
      lines.push("Nyckeltal (värde · förändring mot jämförelseperioden):");
      for (const it of k.items) {
        if (it.value === null) continue;
        const meta = kpi.meta[it.metric]!;
        lines.push(`- ${meta.label}: ${formatMetric(meta, it.value, kpi.currency ?? currency)} · ${formatDelta(meta, it.delta)}`);
      }
    }
    for (const n of kpi.notices) lines.push(`(Obs: ${n})`);

    const rowMetrics = has(p, ROW_METRICS).slice(0, 7);
    const sortBy = rowMetrics.includes("spend") ? "spend" : rowMetrics.includes("sessions") ? "sessions" : rowMetrics[0];
    for (const dim of BREAKDOWNS.filter((d) => ctx.catalog[p]?.dimensions.includes(d))) {
      const t = await run("table", [a.id], { metrics: rowMetrics, dimension: dim, limit: dim === "campaign" ? 15 : 10, sort: sortBy ? { by: sortBy, dir: "desc" } : undefined });
      const b = t.result?.kind === "breakdown" ? (t.result as BreakdownResult) : null;
      if (!b?.rows.length) continue;
      lines.push(``, `### Per ${DIMENSIONS[dim].label.toLowerCase()} (topp ${b.rows.length} av ${b.distinctCount})`);
      lines.push(`| ${DIMENSIONS[dim].label} | ${rowMetrics.map((m) => t.meta[m]?.label ?? m).join(" | ")} |`);
      for (const r of b.rows) {
        const cells = rowMetrics.map((m) => {
          const meta = t.meta[m]!;
          const v = r.values[m] ?? null;
          const prev = r.previous?.[m] ?? null;
          const change = v !== null && prev ? ` (${v >= prev ? "+" : ""}${Math.round(((v - prev) / prev) * 100)} %)` : "";
          return `${formatMetric(meta, v, t.currency ?? currency)}${change}`;
        });
        lines.push(`| ${r.label} | ${cells.join(" | ")} |`);
      }
    }

    if (ctx.catalog[p]?.dimensions.includes("ad")) {
      const adMetrics = has(p, ["spend", "impressions", "ctr", "conversions", "cpa", "video_view_rate", "video_completion_rate"]);
      const g = await run("ad_gallery", [a.id], { metrics: adMetrics, limit: 8, sort: { by: adMetrics[0] ?? "impressions", dir: "desc" } });
      if (g.ads?.length) {
        lines.push("", "### Största annonserna");
        for (const ad of g.ads) {
          const vals = adMetrics.map((m) => `${g.meta[m]?.label}: ${formatMetric(g.meta[m]!, ad.values[m] ?? null, g.currency ?? currency)}`).join(", ");
          lines.push(`- **${ad.name}** (${ad.format ?? "okänt format"}${ad.headline ? `, rubrik: "${ad.headline}"` : ""}): ${vals}`);
          if (ad.text) lines.push(`  Text: "${ad.text.slice(0, 600).replaceAll("\n", " ")}"`);
        }
        // Bilderna (sparade vid synk) skickas med så att Claude kan bedöma kreativet.
        const externalIds = g.ads.map((ad) => ad.key.split("::")[1]!);
        const creatives = await tx.creative.findMany({ where: { accountId: a.id, externalId: { in: externalIds } }, select: { externalId: true, name: true, format: true, imageData: true, imageType: true } });
        for (const ad of g.ads) {
          if (out.images.length >= MAX_IMAGES) break;
          const c = creatives.find((x) => x.externalId === ad.key.split("::")[1]);
          if (!c?.imageData || !c.imageType || c.imageData.byteLength > MAX_IMAGE_BYTES) continue;
          if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(c.imageType)) continue;
          out.images.push({
            label: `${PLATFORMS[p].label} – ${c.name}${c.format === "video" ? " (videoannons, omslagsbild)" : ""}`,
            mediaType: c.imageType as InsightInput["images"][number]["mediaType"],
            data: Buffer.from(c.imageData).toString("base64"),
          });
        }
      }
    }
  }
  out.text = lines.join("\n");
  return out;
}

/** Skickar underlaget till Claude och returnerar den strukturerade analysen. */
export async function generateInsight(input: InsightInput): Promise<{ insight: Insight; model: string; inputTokens: number; outputTokens: number }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL || undefined, maxRetries: 2, timeout: 240_000 });
  const content: Anthropic.ContentBlockParam[] = [{ type: "text", text: input.text }];
  for (const img of input.images) {
    content.push({ type: "text", text: `Bild: ${img.label}` });
    content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
  }
  content.push({ type: "text", text: "Analysera perioden enligt instruktionerna och lämna svaret med lamna_analys." });

  const model = AI_MODEL();
  const res = await client.messages.create({
    model,
    max_tokens: 8000,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content }],
  });
  const block = res.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
  if (!block) throw new Error("AI:n lämnade ingen analys.");
  const parsed = insightSchema.safeParse(block.input);
  if (!parsed.success) throw new Error("AI:ns svar hade fel format. Försök igen.");
  return { insight: parsed.data, model: res.model, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
}

// ─── Sammanfattning till kunden ─────────────────────────────────────────────

const SUMMARY_TOOL: Anthropic.Tool = {
  name: "lamna_sammanfattning",
  description: "Lämna sammanfattningen till kunden.",
  input_schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "Sammanfattningen. Stycken skiljs med en tom rad; punktlistor skrivs som rader som börjar med \"- \".",
      },
    },
    required: ["text"],
  },
};

const SUMMARY_SYSTEM = `Du skriver månadens sammanfattning till byråns kund, som läser den i sin rapport. Du är byråns ansvariga performance marketing-strateg.

- Skriv på svenska, i vi-form för byrån och du-/ni-form till kunden. Professionellt, tydligt och ärligt – inte säljigt.
- 150–250 ord. Börja med ett kort stycke om hur perioden gick mot målen. Följ med "Höjdpunkter" som 2–4 punkter med konkreta siffror, och avsluta med "Det här gör vi härnäst" som 2–3 punkter.
- Använd kundens språk: inga interna termer, ingen kritik av byråns egna inställningar, inga osäkra gissningar. Nämn svagheter sakligt tillsammans med vad vi gör åt dem.
- Rubrikerna skrivs som egna rader utan markdown-tecken. Punktlistor börjar med "- ".
- Lämna texten med verktyget lamna_sammanfattning.`;

/** Kundvänligt utkast till sammanfattning (granskas och publiceras av byrån). */
export async function generateClientSummary(input: InsightInput): Promise<{ text: string; model: string }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL || undefined, maxRetries: 2, timeout: 180_000 });
  const content: Anthropic.ContentBlockParam[] = [{ type: "text", text: input.text }];
  for (const img of input.images.slice(0, 4)) {
    content.push({ type: "text", text: `Bild: ${img.label}` });
    content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
  }
  content.push({ type: "text", text: "Skriv sammanfattningen till kunden och lämna den med lamna_sammanfattning." });
  const res = await client.messages.create({
    model: AI_MODEL(),
    max_tokens: 2000,
    system: SUMMARY_SYSTEM,
    tools: [SUMMARY_TOOL],
    tool_choice: { type: "tool", name: SUMMARY_TOOL.name },
    messages: [{ role: "user", content }],
  });
  const block = res.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
  const text = (block?.input as { text?: unknown } | undefined)?.text;
  if (typeof text !== "string" || !text.trim()) throw new Error("AI:n lämnade ingen sammanfattning.");
  return { text: text.trim(), model: res.model };
}
