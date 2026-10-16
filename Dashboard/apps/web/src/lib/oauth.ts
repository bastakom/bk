import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";

const COOKIE = "rp_oauth";

const pendingSchema = z.object({
  state: z.string(),
  connectorId: z.string(),
  /** Koppla om: inloggningen som ersätts (t.ex. återkallad eller utgången). */
  reconnectConnectionId: z.string().optional(),
});
export type PendingOAuth = z.infer<typeof pendingSchema>;

export const redirectUri = () => `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/api/connect/callback`;

export async function savePendingOAuth(p: PendingOAuth) {
  (await cookies()).set(COOKIE, JSON.stringify(p), { httpOnly: true, sameSite: "lax", path: "/api/connect", maxAge: 600, secure: process.env.NODE_ENV === "production" });
}

/** Läser och tar bort det sparade OAuth-tillståndet. Returnerar null om state inte matchar (CSRF-skydd). */
export async function consumePendingOAuth(state: string | null): Promise<PendingOAuth | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  jar.delete({ name: COOKIE, path: "/api/connect" });
  if (!raw || !state) return null;
  const parsed = pendingSchema.safeParse(JSON.parse(raw));
  return parsed.success && parsed.data.state === state ? parsed.data : null;
}
