import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/dal";
import { OnboardingForm } from "./form";

export const metadata = { title: "Skapa byrå" };

export default async function OnboardingPage() {
  const user = await requireUser();
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 p-6">
      <Logo />
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-soft">
        <h1 className="text-2xl leading-tight font-bold tracking-tight text-heading">Hej {user.name.split(" ")[0]}! Vad heter byrån?</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Du blir administratör och kan bjuda in kollegor efteråt.</p>
        <OnboardingForm />
      </div>
    </div>
  );
}
