import type { Metadata, Viewport } from "next";
import "@fluxo/tokens/tokens.css";
import "@fluxo/ui-web/fluxo.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Fluxo", template: "%s · Fluxo" },
  description: "Agenda, presença e evolução do seu estúdio.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2B6A63",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
