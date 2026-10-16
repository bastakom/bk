import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Skapa konto" };

export default function SignUpPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-h1 font-bold tracking-tight text-heading">Skapa konto</h1>
        <p className="text-sm text-muted-foreground">Kom igång på en minut. Du skapar din byrå i nästa steg.</p>
      </div>
      <Suspense>
        <AuthForm mode="sign-up" />
      </Suspense>
      <p className="text-center text-sm text-muted-foreground">
        Har du redan ett konto?{" "}
        <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
          Logga in
        </Link>
      </p>
    </div>
  );
}
