import { requireWorkspace } from "@/lib/dal";
import { loadHome } from "@/lib/home-data";
import { HomeView } from "./clients-overview";

export const metadata = { title: "Kunder" };

/** Startsidan: hälsning, byråns läge, kunderna och det som behöver göras. */
export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  const ctx = await requireWorkspace();
  const home = await ctx.tx((tx) => loadHome(tx));
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
      <HomeView
        {...home}
        userName={ctx.user.name}
        canEdit={ctx.can("EDITOR")}
        canPick={ctx.can("EDITOR") && !ctx.clientIds}
        isAdmin={ctx.can("ADMIN")}
        canCreate={ctx.can("EDITOR") && !ctx.clientIds}
        openNew={sp.ny === "1"}
      />
    </div>
  );
}
