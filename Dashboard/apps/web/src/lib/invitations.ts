/**
 * Inbjudningar via mejl. Länken innehåller en slumpad token (32 byte); bara dess
 * sha256 sparas. Mottagaren väljer namn och lösenord och blir medlem med den roll
 * och de kunder som angavs. Gäller i 14 dagar och kan bara användas en gång.
 */
import "server-only";
import { db, type Role } from "@rp/db";
import { getMailer, workspaceSender } from "@rp/reports";
import { createHash, randomBytes } from "node:crypto";
import { appUrl } from "./app-url";

export const INVITE_DAYS = 14;
export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function createInvitation(p: { workspaceId: string; email: string; name?: string; role: Role; clientIds: string[]; createdById: string }) {
  const token = randomBytes(32).toString("base64url");
  // En ny inbjudan ersätter tidigare oanvända till samma adress.
  await db.invitation.deleteMany({ where: { workspaceId: p.workspaceId, email: p.email, acceptedAt: null } });
  await db.invitation.create({
    data: {
      workspaceId: p.workspaceId,
      email: p.email,
      name: p.name || null,
      role: p.role,
      clientIds: p.clientIds,
      tokenHash: hashInviteToken(token),
      expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
      createdById: p.createdById,
    },
  });
  const url = `${appUrl()}/invite/${token}`;
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: p.workspaceId } });
  const inviter = await db.user.findUnique({ where: { id: p.createdById }, select: { name: true } });
  const portal = p.role === "CLIENT";
  const lead = portal
    ? `${inviter?.name ?? ws.name} har gett dig tillgång till era rapporter hos ${ws.name}.`
    : `${inviter?.name ?? ws.name} har bjudit in dig till ${ws.name} i rapportplattformen.`;
  const html = `<!doctype html><html lang="sv"><body style="margin:0;background:#fbf8f7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f2d42">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden">
<tr><td style="background:${esc(ws.brandColor)};padding:16px 28px;color:#fff;font-size:13px;letter-spacing:.04em;text-transform:uppercase">${esc(ws.name)}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:20px;font-weight:400;color:#25364f">${esc(lead)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.55">Välj ett lösenord för att komma igång. Länken gäller i ${INVITE_DAYS} dagar.</p>
<a href="${esc(url)}" style="display:inline-block;background:#25364f;color:#fff;text-decoration:none;padding:11px 18px;border-radius:9px;font-size:14px;font-weight:600">Kom igång</a>
</td></tr></table></td></tr></table></body></html>`;
  await getMailer().send({
    from: workspaceSender(ws),
    to: [p.email],
    subject: portal ? `Era rapporter hos ${ws.name}` : `Inbjudan till ${ws.name}`,
    html,
    text: `${lead}\n\nVälj ett lösenord här (gäller i ${INVITE_DAYS} dagar):\n${url}`,
    attachments: [],
  });
  return url;
}

/** Giltig, oanvänd inbjudan för en token. */
export async function findInvitation(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const inv = await db.invitation.findUnique({ where: { tokenHash: hashInviteToken(token) }, include: { workspace: { select: { name: true, logoUrl: true, brandColor: true } } } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) return null;
  return inv;
}

/** Gör användaren till medlem enligt inbjudan och förbrukar den. */
export async function acceptInvitation(invId: string, userId: string) {
  return db.$transaction(async (tx) => {
    const inv = await tx.invitation.update({ where: { id: invId, acceptedAt: null }, data: { acceptedAt: new Date() } });
    await tx.membership.upsert({
      where: { workspaceId_userId: { workspaceId: inv.workspaceId, userId } },
      create: { workspaceId: inv.workspaceId, userId, role: inv.role, clientIds: inv.clientIds },
      update: { role: inv.role, clientIds: inv.clientIds },
    });
    return inv;
  });
}
