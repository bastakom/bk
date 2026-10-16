import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Logga in" };

export default function SignInPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-h1 font-bold tracking-tight text-heading">Logga in</h1>
        <p className="text-sm text-muted-foreground">Välkommen tillbaka.</p>
      </div>
      <Suspense>
        <AuthForm mode="sign-in" />
      </Suspense>
      <p className="text-center text-sm text-muted-foreground">
        Ny här?{" "}
        <Link href="/sign-up" className="font-medium text-foreground underline-offset-4 hover:underline">
          Skapa konto
        </Link>
      </p>
    </div>
  );
}
