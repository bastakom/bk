import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/dal";
import { Showcase } from "./showcase";

export const metadata = { title: "Designsystem" };

/** Intern referens: alla tokens och komponenter med sina tillstånd, i ljust och mörkt tema. */
export default async function DesignSystemPage() {
  await requireWorkspace();
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
      <PageHeader title="Designsystem" description="Tokens och komponenter som alla skärmar bygger på. Växla tema i sidomenyn för att se mörkt läge." />
      <Showcase />
    </div>
  );
}
