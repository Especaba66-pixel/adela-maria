import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

const titulo = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--fuente-titulo" });
const texto = Inter({ subsets: ["latin"], variable: "--fuente-texto" });

export const metadata: Metadata = {
  title: "Adela María · Belleza holística",
  description: "Gestión del centro",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fffdf9" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${titulo.variable} ${texto.variable}`}>
      <body className="min-h-dvh bg-fondo antialiased">{children}</body>
    </html>
  );
}
