/**
 * White label: delade länkar på byråns egen domän och egen avsändare för mejl.
 *
 *  - Domän: verifieras med en TXT-post (_bk-rapport.<domän>) som innehåller en kod
 *    som bara byrån har. CNAME-posten pekar domänen mot appen.
 *  - På en egen domän visas bara delade rapporter (/s/…) som tillhör den byrån.
 *  - Avsändare: domänen i adressen måste vara verifierad hos Resend (SPF/DKIM).
 */
import "server-only";
import { db } from "@rp/db";
import { createHmac } from "node:crypto";
import { resolveCname, resolveTxt } from "node:dns/promises";
import { appUrl } from "./app-url";

export const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
export const TXT_PREFIX = "_bk-rapport";

/** Verifieringskoden för byråns domän (härledd ur appens hemlighet, kan inte gissas). */
export const domainToken = (workspaceId: string) =>
  `bk-rapport-verify=${createHmac("sha256", process.env.BETTER_AUTH_SECRET!).update(`domain:${workspaceId}`).digest("base64url").slice(0, 32)}`;

/** Appens publika värdnamn (CNAME-målet), t.ex. app.bastakompisar.se. */
export const appHost = () => new URL(process.env.BETTER_AUTH_URL ?? appUrl()).host;

const isAppHost = (host: string) => {
  const h = host.toLowerCase().split(":")[0]!;
  return h === appHost().split(":")[0] || h === "localhost" || h === "127.0.0.1";
};

/** Byrån som äger en (verifierad) egen domän, eller null om värden är appens egen. */
export async function customHostWorkspace(host: string | null): Promise<{ id: string } | null | "unknown"> {
  if (!host || isAppHost(host)) return null;
  const domain = host.toLowerCase().split(":")[0]!;
  const ws = await db.workspace.findFirst({ where: { customDomain: domain, domainVerifiedAt: { not: null } }, select: { id: true } });
  return ws ?? "unknown";
}

/** Bas-URL för delade länkar: byråns verifierade domän, annars appens adress. */
export function shareBaseUrl(ws: { customDomain: string | null; domainVerifiedAt: Date | null }) {
  return ws.customDomain && ws.domainVerifiedAt ? `https://${ws.customDomain}` : appUrl();
}

export interface DomainCheck {
  txt: boolean;
  cname: string | null;
  cnameOk: boolean;
}

/** Kontrollerar DNS-posterna för domänen. TXT-posten avgör; CNAME visas som stöd. */
export async function checkDomain(domain: string, workspaceId: string): Promise<DomainCheck> {
  const token = domainToken(workspaceId);
  const txt = await resolveTxt(`${TXT_PREFIX}.${domain}`).then(
    (rows) => rows.some((parts) => parts.join("") === token),
    () => false,
  );
  const cname = await resolveCname(domain).then(
    (r) => r[0] ?? null,
    () => null,
  );
  return { txt, cname, cnameOk: !!cname && cname.replace(/\.$/, "") === appHost().split(":")[0] };
}

/** Kontrollerar att avsändarens domän är verifierad hos Resend. */
export async function checkSender(email: string): Promise<{ ok: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: "E-posttjänsten (RESEND_API_KEY) är inte konfigurerad – mejl hamnar i den lokala utkorgen." };
  const domain = email.split("@")[1]?.toLowerCase();
  const res = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!res?.ok) return { ok: false, reason: "Kunde inte kontrollera domänen hos Resend just nu." };
  const body = (await res.json()) as { data?: { name: string; status: string }[] };
  const d = body.data?.find((x) => x.name.toLowerCase() === domain);
  if (!d) return { ok: false, reason: `Domänen ${domain} är inte tillagd i Resend.` };
  return d.status === "verified" ? { ok: true } : { ok: false, reason: `Domänen ${domain} är inte verifierad i Resend än (status: ${d.status}).` };
}

export async function workspaceWhiteLabel(workspaceId: string) {
  return db.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { customDomain: true, domainVerifiedAt: true, emailFrom: true, emailFromName: true, emailVerifiedAt: true },
  });
}
