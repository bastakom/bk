import type { Metadata } from "next";
import { DM_Sans, Figtree, Geist, Geist_Mono, IBM_Plex_Sans, Inter, Plus_Jakarta_Sans, Source_Sans_3 } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Appens typsnitt: modernt, tydligt och med starka siffror.
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
// Figtree ligger nära Bästa Kompisars Sofia Pro och är kvar som val för rapporter (white label).
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"], preload: false });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], preload: false });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Valbara typsnitt för byråns varumärke (white label). Laddas bara när de används.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], preload: false });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], preload: false });
const ibmPlex = IBM_Plex_Sans({ variable: "--font-ibm-plex", subsets: ["latin"], weight: ["400", "500", "600"], preload: false });
const sourceSans = Source_Sans_3({ variable: "--font-source-sans", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: { default: "Rapport · Bästa Kompisar", template: "%s · Bästa Kompisar" },
  description: "Live-dashboards och rapporter för byråns kunder",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sv" suppressHydrationWarning className={`${jakarta.variable} ${figtree.variable} ${geistSans.variable} ${geistMono.variable} ${inter.variable} ${dmSans.variable} ${ibmPlex.variable} ${sourceSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster richColors position="bottom-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
