import { db } from "@rp/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/dal";
import { findInvitation } from "@/lib/invitations";
import { acceptAsSignedIn } from "./actions";
import { NewUserForm } from "./new-user-form";

export const metadata = { title: "Inbjudan", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const inv = await findInvitation(token);
  if (!inv) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 font-bold tracking-tight text-heading">Inbjudan gäller inte längre</h1>
        <p className="text-sm text-muted-foreground">Länken har redan använts eller gått ut. Be den som bjöd in dig att skicka en ny.</p>
        <Button asChild variant="outline">
          <Link href="/sign-in">Till inloggningen</Link>
        </Button>
      </div>
    );
  }
  const portal = inv.role === "CLIENT";
  const session = await getSession();
  const hasAccount = !session && (await db.user.findUnique({ where: { email: inv.email }, select: { id: true } }));

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-h1 font-bold tracking-tight text-heading">{portal ? `Era rapporter hos ${inv.workspace.name}` : `Välkommen till ${inv.workspace.name}`}</h1>
        <p className="text-sm text-muted-foreground">{portal ? "Här ser du era rapporter, alltid med aktuella siffror." : "Du har bjudits in till byråns rapportplattform."}</p>
      </div>
      {session ? (
        session.user.email.toLowerCase() === inv.email ? (
          <form action={acceptAsSignedIn.bind(null, token)}>
            <Button type="submit" className="w-full">
              Gå med som {session.user.name}
            </Button>
          </form>
        ) : (
          <p role="alert" className="rounded-md bg-warning-soft px-3 py-2 text-sm">
            Du är inloggad som {session.user.email}, men inbjudan gäller {inv.email}. Logga ut och öppna länken igen.
          </p>
        )
      ) : hasAccount ? (
        <div className="space-y-3">
          <p className="text-sm">Det finns redan ett konto för {inv.email}. Logga in så läggs du till.</p>
          <Button asChild className="w-full">
            <Link href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`}>Logga in</Link>
          </Button>
        </div>
      ) : (
        <NewUserForm token={token} email={inv.email} name={inv.name ?? ""} />
      )}
    </div>
  );
}
