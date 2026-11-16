import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { landing } from "@fluxo/copy";
import "@fluxo/tokens/tokens.css";
import "@fluxo/ui-web/fluxo.css";
import "./globals.css";
import { SITE_URL } from "@/lib/urls";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-figtree" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: landing.meta.title,
  description: landing.meta.description,
  alternates: { canonical: "/" },
  openGraph: { title: landing.meta.title, description: landing.meta.description, type: "website", locale: "pt_BR", siteName: "Fluxo" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2B6A63" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={figtree.variable}>
      <body>{children}</body>
    </html>
  );
}
