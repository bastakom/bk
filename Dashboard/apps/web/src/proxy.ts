import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistisk kontroll: utan sessionscookie skickas man till inloggning.
 * Den riktiga behörighetskontrollen görs i data access-lagret (lib/dal.ts).
 */
export function proxy(request: NextRequest) {
  // Byråns egen domän (white label) visar bara delade rapporter (/s/…), inte appen.
  if (isCustomHost(request.headers.get("host"))) return new NextResponse("Sidan finns inte.", { status: 404 });
  if (!getSessionCookie(request)) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

/** Annan värd än appens egen (BETTER_AUTH_URL) eller localhost = en byrås egen domän. */
function isCustomHost(host: string | null) {
  if (!host) return false;
  const h = host.toLowerCase().split(":")[0]!;
  const app = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").hostname;
  return h !== app && h !== "localhost" && h !== "127.0.0.1";
}

export const config = {
  matcher: ["/((?!api/auth|api/connect/callback|api/media/|api/cron/|sign-in|sign-up|invite/|connect/mock-consent|print/|s/|brand/|_next|favicon.ico).*)"],
};
