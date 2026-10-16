import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col p-6 md:p-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
      {/* Som bastakompisar.se: persikofärgad yta, navy rubrik, korall "→"-länkstil. */}
      <div className="relative hidden overflow-hidden bg-[var(--bk-peach)] text-[var(--bk-navy)] lg:block dark:bg-[#1c2a40] dark:text-[var(--bk-peach)]">
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <p className="text-sm font-medium tracking-[0.14em] uppercase">Bästa Kompisar · Rapport</p>
          <div>
            <h2 className="max-w-lg text-[44px] leading-[1.1] font-normal text-balance xl:text-[52px]">Alla kunders kanaler på ett ställe.</h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed opacity-80">Live-dashboards och rapporter som är klara att skicka, med samma siffror i appen, i PDF:en och i mejlet.</p>
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-6">
              {[
                ["5", "Kanaler"],
                ["Live", "Dashboards"],
                ["PDF", "Rapporter"],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="text-[44px] leading-none font-bold tabular-nums">{n}</dd>
                  <dd className="mt-2 text-xs font-medium tracking-[0.14em] uppercase opacity-80">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="text-sm opacity-75">GA4 · Google Ads · Meta · LinkedIn · TikTok</p>
        </div>
      </div>
    </div>
  );
}
