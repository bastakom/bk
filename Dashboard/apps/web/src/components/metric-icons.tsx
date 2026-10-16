/**
 * Illustrerade ikoner för nyckeltal (KPI-kort och nyckeltalslistor) i Bästa Kompisars stil:
 * navy linjer, ljusblå fyllnad och en liten persikofärgad accent. Dekorativa: värdet och
 * etiketten står alltid i text bredvid.
 */
import { cn } from "@/lib/utils";

const INK = "var(--icon-ink, #13213a)";
const FILL = "var(--icon-fill, #dbe7ff)";
const ACCENT = "var(--icon-accent, #f7b9a8)";

type Glyph = () => React.ReactNode;

const s = { stroke: INK, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

/** Små strålar runt en ikon (ger den illustrerade känslan). */
const Rays = ({ cx = 24, cy = 24, r = 19 }: { cx?: number; cy?: number; r?: number }) => (
  <g stroke={ACCENT} strokeWidth={2.4} strokeLinecap="round">
    {[-120, -60, 0, 180].map((a) => {
      const rad = (a * Math.PI) / 180;
      return <line key={a} x1={cx + Math.cos(rad) * r} y1={cy + Math.sin(rad) * r} x2={cx + Math.cos(rad) * (r + 3.5)} y2={cy + Math.sin(rad) * (r + 3.5)} />;
    })}
  </g>
);

export const METRIC_ICONS = {
  eye: () => (
    <>
      <Rays />
      <path d="M7 24c4-7 10-11 17-11s13 4 17 11c-4 7-10 11-17 11S11 31 7 24Z" {...s} fill={FILL} />
      <circle cx="24" cy="24" r="5.5" fill={INK} />
      <circle cx="26" cy="22" r="1.6" fill="#fff" />
    </>
  ),
  coins: () => (
    <>
      <ellipse cx="20" cy="31" rx="11" ry="4" {...s} fill={FILL} />
      <path d="M9 31v5c0 2.2 4.9 4 11 4s11-1.8 11-4v-5" {...s} />
      <ellipse cx="29" cy="17" rx="10" ry="3.6" {...s} fill={FILL} />
      <path d="M19 17v6c0 2 4.5 3.6 10 3.6s10-1.6 10-3.6v-6" {...s} />
      <circle cx="40" cy="9" r="2.4" fill={ACCENT} />
    </>
  ),
  person: () => (
    <>
      <Rays cy={20} r={15} />
      <circle cx="24" cy="15" r="6" {...s} fill={FILL} />
      <path d="M13 40c0-7 4.9-12 11-12s11 5 11 12" {...s} fill={FILL} />
      <ellipse cx="24" cy="42" rx="12" ry="2" fill={ACCENT} opacity=".7" />
    </>
  ),
  cursor: () => (
    <>
      <Rays cx={18} cy={18} r={13} />
      <path d="m16 14 20 8-8.5 3.2L24 34Z" {...s} fill={FILL} />
      <path d="m27.5 25.2 7.5 8" {...s} />
    </>
  ),
  cost_click: () => (
    <>
      <ellipse cx="17" cy="30" rx="9" ry="3.4" {...s} fill={FILL} />
      <path d="M8 30v5c0 1.9 4 3.4 9 3.4s9-1.5 9-3.4v-5" {...s} />
      <path d="m26 12 15 6-6.4 2.4L32 27Z" {...s} fill={ACCENT} />
    </>
  ),
  frequency: () => (
    <>
      <rect x="8" y="10" width="26" height="22" rx="3" {...s} fill={FILL} />
      <circle cx="21" cy="19" r="3.6" {...s} />
      <path d="M14 29c1-3.5 3.8-5.5 7-5.5s6 2 7 5.5" {...s} />
      <circle cx="35" cy="33" r="7" {...s} fill="#fff" />
      <circle cx="35" cy="33" r="2.2" fill={INK} />
    </>
  ),
  recall: () => (
    <>
      <circle cx="20" cy="16" r="6" {...s} fill={FILL} />
      <path d="M10 38c0-6.5 4.5-11 10-11s10 4.5 10 11" {...s} fill={FILL} />
      <path d="m31 20 8-8M31 12h0M39 20h0" {...s} />
      <circle cx="31.5" cy="12.5" r="2" fill={ACCENT} />
      <circle cx="38.5" cy="19.5" r="2" fill={ACCENT} />
    </>
  ),
  play: () => (
    <>
      <circle cx="24" cy="24" r="16" fill={INK} />
      <path d="M20 16.5v15l12-7.5Z" fill="#fff" />
      <circle cx="39" cy="10" r="2.6" fill={ACCENT} />
    </>
  ),
  video_rate: () => (
    <>
      <rect x="13" y="6" width="22" height="36" rx="4" fill={INK} />
      <path d="M21 19v10l8-5Z" fill="#fff" />
      <path d="M38 14a12 12 0 0 1 0 20" stroke={ACCENT} strokeWidth={2.4} fill="none" strokeLinecap="round" />
    </>
  ),
  engagement: () => (
    <>
      <Rays />
      <circle cx="24" cy="24" r="10" {...s} fill={FILL} />
      <circle cx="24" cy="24" r="3.5" fill={INK} />
      <path d="m27 27 7 11 2-5 5-2-11-7" {...s} fill={ACCENT} />
    </>
  ),
  heart: () => (
    <>
      <circle cx="24" cy="24" r="17" fill="#f36b72" />
      <path d="M24 33s-9-5.2-9-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.8-9 11-9 11Z" fill="#fff" />
    </>
  ),
  comment: () => (
    <>
      <path d="M8 22c0-7 7-12 16-12s16 5 16 12-7 12-16 12c-2 0-4-.3-5.8-.8L10 37l2-6.2C9.4 28.5 8 25.4 8 22Z" fill={INK} />
      <circle cx="17" cy="22" r="2" fill="#fff" />
      <circle cx="24" cy="22" r="2" fill="#fff" />
      <circle cx="31" cy="22" r="2" fill="#fff" />
    </>
  ),
  share: () => (
    <>
      <path d="M26 12v7C14 20 9 27 8 36c4-5 9-7 18-7v7l14-12Z" {...s} fill={FILL} />
      <circle cx="40" cy="10" r="2.6" fill={ACCENT} />
    </>
  ),
  bookmark: () => (
    <>
      <path d="M14 8h20a2 2 0 0 1 2 2v30l-12-8-12 8V10a2 2 0 0 1 2-2Z" {...s} fill={FILL} />
      <path d="M19 17h10" stroke={ACCENT} strokeWidth={2.6} strokeLinecap="round" />
    </>
  ),
  target: () => (
    <>
      <circle cx="22" cy="26" r="15" {...s} fill={FILL} />
      <circle cx="22" cy="26" r="8.5" {...s} fill="#fff" />
      <circle cx="22" cy="26" r="3" fill={INK} />
      <path d="m22 26 16-16M33 10h5v5" {...s} />
      <circle cx="38" cy="10" r="2.4" fill={ACCENT} />
    </>
  ),
  clock: () => (
    <>
      <rect x="7" y="9" width="30" height="24" rx="3" {...s} fill={FILL} />
      <path d="M7 15h30" {...s} />
      <circle cx="34" cy="34" r="8" {...s} fill="#fff" />
      <path d="M34 30v4l2.5 2" {...s} />
      <circle cx="11" cy="12" r="1" fill={INK} />
    </>
  ),
  browser: () => (
    <>
      <rect x="7" y="9" width="34" height="28" rx="3" {...s} fill={FILL} />
      <path d="M7 16h34" {...s} />
      <rect x="13" y="22" width="14" height="3" rx="1.5" fill={INK} />
      <rect x="13" y="28" width="20" height="3" rx="1.5" fill={ACCENT} />
    </>
  ),
  users: () => (
    <>
      <circle cx="18" cy="17" r="5.5" {...s} fill={FILL} />
      <path d="M8 38c0-6 4.5-10 10-10s10 4 10 10" {...s} fill={FILL} />
      <circle cx="32" cy="15" r="4.5" {...s} />
      <path d="M30 26c5.5 0 10 3.5 10 9" {...s} />
      <circle cx="39" cy="9" r="2.2" fill={ACCENT} />
    </>
  ),
  conversion: () => (
    <>
      <path d="M9 12h30l-11 13v11l-8 4V25Z" {...s} fill={FILL} />
      <circle cx="37" cy="36" r="6" fill={ACCENT} />
      <path d="m34.5 36 1.8 1.8 3.4-3.6" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  chart: () => (
    <>
      <rect x="9" y="24" width="7" height="14" rx="2" {...s} fill={FILL} />
      <rect x="20.5" y="16" width="7" height="22" rx="2" {...s} fill={FILL} />
      <rect x="32" y="9" width="7" height="29" rx="2" fill={INK} />
      <circle cx="40" cy="7" r="2.4" fill={ACCENT} />
    </>
  ),
} satisfies Record<string, Glyph>;

export type MetricIconId = keyof typeof METRIC_ICONS;

export const ICON_LABELS: Record<MetricIconId, string> = {
  eye: "Öga (exponeringar, visningar)",
  coins: "Mynt (spend, budget)",
  person: "Person (räckvidd)",
  cursor: "Muspekare (klick)",
  cost_click: "Kostnad per klick",
  frequency: "Frekvens",
  recall: "Ad recall",
  play: "Play (video)",
  video_rate: "Videoandel",
  engagement: "Engagemang",
  heart: "Hjärta (likes)",
  comment: "Pratbubbla (kommentarer)",
  share: "Dela",
  bookmark: "Bokmärke (sparade)",
  target: "Måltavla (konverteringar)",
  clock: "Klocka (tid)",
  browser: "Webbläsare (sidor)",
  users: "Användare",
  conversion: "Konvertering",
  chart: "Diagram",
};

/** Standardikon per nyckeltal (kan bytas per widget). */
const AUTO: Record<string, MetricIconId> = {
  spend: "coins",
  impressions: "eye",
  cpm: "coins",
  reach: "person",
  frequency: "frequency",
  clicks: "cursor",
  link_clicks: "cursor",
  ctr: "cursor",
  link_ctr: "cursor",
  cpc: "cost_click",
  ad_recallers: "recall",
  ad_recall_rate: "recall",
  video_starts: "play",
  video_views: "play",
  video_q25: "video_rate",
  video_q50: "video_rate",
  video_q75: "video_rate",
  video_completions: "video_rate",
  video_view_rate: "video_rate",
  video_completion_rate: "video_rate",
  view_rate: "video_rate",
  cpv: "cost_click",
  video_q25_rate: "video_rate",
  video_q50_rate: "video_rate",
  video_q75_rate: "video_rate",
  video_q100_rate: "video_rate",
  page_views: "browser",
  views_per_user: "browser",
  engagement_time: "clock",
  avg_engagement_time: "clock",
  engagements: "engagement",
  engagement_rate: "engagement",
  eri: "engagement",
  likes: "heart",
  reactions: "heart",
  comments: "comment",
  shares: "share",
  saves: "bookmark",
  follows: "users",
  conversions: "target",
  conversion_rate: "conversion",
  conversion_value: "coins",
  cpa: "target",
  roas: "chart",
  sessions: "chart",
  users: "person",
  new_users: "users",
  new_user_share: "users",
  engaged_sessions: "engagement",
  session_engagement_rate: "engagement",
  bounce_rate: "browser",
  avg_session_duration: "clock",
  session_duration: "clock",
};

export const autoIcon = (metric: string): MetricIconId => AUTO[metric] ?? "chart";

/** Ikonen för ett nyckeltal. `icon` = valt id, "auto" eller undefined = standard. */
export function MetricIcon({ metric, icon, className }: { metric: string; icon?: string; className?: string }) {
  const id = (icon && icon !== "auto" && icon in METRIC_ICONS ? icon : autoIcon(metric)) as MetricIconId;
  const Glyph = METRIC_ICONS[id];
  return (
    <svg viewBox="0 0 48 48" className={cn("size-12 shrink-0", className)} aria-hidden>
      <Glyph />
    </svg>
  );
}
