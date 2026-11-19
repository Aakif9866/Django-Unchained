import type { Metadata, Viewport } from "next";
import { Providers } from "@/shell/Providers";
import "./globals.css";

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
  themeColor: "#050508",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
