/**
 * E-post. Med RESEND_API_KEY skickas via Resend; annars hamnar mejlen i en
 * lokal utkorg (.outbox/) som kan förhandsvisas i appen under Utskick.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export interface OutgoingMail {
  /** Avsändare (white label); annars MAIL_FROM */
  from?: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  attachments: { filename: string; content: Buffer }[];
}

export interface SentMail {
  provider: "resend" | "outbox";
  id?: string;
  /** Endast utkorgen: var filerna sparades */
  pdfPath?: string;
  htmlPath?: string;
}

export interface Mailer {
  send(mail: OutgoingMail): Promise<SentMail>;
}

/** Repots rot (där pnpm-workspace.yaml finns) – fungerar både i Next och i workern. */
function repoRoot(from = process.cwd()): string {
  let dir = resolve(from);
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const up = dirname(dir);
    if (up === dir) return resolve(from);
    dir = up;
  }
  return dir;
}

export const OUTBOX_DIR = process.env.OUTBOX_DIR ?? join(repoRoot(), ".outbox");

export class OutboxMailer implements Mailer {
  async send(mail: OutgoingMail): Promise<SentMail> {
    const dir = join(OUTBOX_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 7)}`);
    await mkdir(dir, { recursive: true });
    const htmlPath = join(dir, "mail.html");
    await writeFile(htmlPath, mail.html);
    await writeFile(join(dir, "mail.json"), JSON.stringify({ from: mail.from ?? process.env.MAIL_FROM ?? null, to: mail.to, subject: mail.subject, text: mail.text, attachments: mail.attachments.map((a) => a.filename) }, null, 2));
    let pdfPath: string | undefined;
    for (const a of mail.attachments) {
      const p = join(dir, a.filename);
      await writeFile(p, a.content);
      pdfPath ??= p;
    }
    return { provider: "outbox", pdfPath, htmlPath };
  }
}

export class ResendMailer implements Mailer {
  constructor(
    private apiKey: string,
    private from: string,
  ) {}

  async send(mail: OutgoingMail): Promise<SentMail> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: mail.from ?? this.from,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        attachments: mail.attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Resend svarade ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { id?: string };
    return { provider: "resend", id: body.id };
  }
}

export function getMailer(): Mailer {
  const key = process.env.RESEND_API_KEY;
  return key ? new ResendMailer(key, process.env.MAIL_FROM ?? "Rapporter <rapporter@example.com>") : new OutboxMailer();
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Enkel, robust HTML (tabellbaserad för e-postklienter) med byråns färg. */
export function reportEmail(p: {
  agency: string;
  brandColor: string;
  client: string;
  dashboard: string;
  period: string;
  message?: string | null;
  url: string;
  filename: string;
  /** Kundens språk */
  lang?: "sv" | "en";
}): { html: string; text: string } {
  const msg = (p.message ?? "").trim();
  const en = p.lang === "en";
  const attached = en ? `The report is attached as a PDF (${p.filename}).` : `Rapporten finns bifogad som PDF (${p.filename}).`;
  const html = `<!doctype html>
<html lang="${en ? "en" : "sv"}"><body style="margin:0;background:#fbf8f7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f2d42">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf8f7;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:${esc(p.brandColor)};padding:20px 28px;color:#fff;font-size:13px;letter-spacing:.04em;text-transform:uppercase">${esc(p.agency)}</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 4px;font-size:14px;color:#5e6b7e">${esc(p.client)}</p>
<h1 style="margin:0 0 6px;font-size:26px;line-height:1.25;font-weight:400;color:#25364f">${esc(p.dashboard)}</h1>
<p style="margin:0 0 20px;font-size:15px">${esc(p.period)}</p>
${msg ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.55;white-space:pre-line">${esc(msg)}</p>` : ""}
<p style="margin:0 0 24px;font-size:15px;line-height:1.55">${esc(attached)}</p>
<a href="${esc(p.url)}" style="display:inline-block;background:${esc(p.brandColor)};color:#fff;text-decoration:none;padding:11px 18px;border-radius:9px;font-size:14px;font-weight:600">${en ? "Open the live dashboard" : "Öppna live-dashboarden"}</a>
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #ebe3e0;font-size:12px;color:#5e6b7e">${en ? "Sent by" : "Skickat av"} ${esc(p.agency)}.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [`${p.client} – ${p.dashboard}`, p.period, "", msg, "", attached, `Live-dashboard: ${p.url}`]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");
  return { html, text };
}

/** Byråns egen avsändare om den är verifierad, annars standardavsändaren (MAIL_FROM). */
export function workspaceSender(ws: { name: string; emailFrom: string | null; emailFromName: string | null; emailVerifiedAt: Date | null }): string | undefined {
  if (!ws.emailFrom || !ws.emailVerifiedAt) return undefined;
  const name = (ws.emailFromName ?? ws.name).replace(/["<>]/g, "");
  return `${name} <${ws.emailFrom}>`;
}
