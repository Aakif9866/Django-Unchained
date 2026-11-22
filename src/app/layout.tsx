import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Providers } from "@/shell/Providers";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", variable: "--font-serif" });

export const metadata: Metadata = {
  title: "On Hold · Games for the in-between",
  description: "Polished one-thumb arcade games that pause the instant you look away. No sign-up, works offline.",
  applicationName: "On Hold",
  appleWebApp: { capable: true, title: "On Hold", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

// Apply the saved colour grade before first paint, so a non-default grade never flashes the default.
const PALETTE_BOOT = `try{var p=JSON.parse(localStorage.getItem("onhold")||"{}").state;if(p&&p.palette)document.documentElement.dataset.palette=p.palette}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" data-palette="aurora" className={`${sans.variable} ${mono.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PALETTE_BOOT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
