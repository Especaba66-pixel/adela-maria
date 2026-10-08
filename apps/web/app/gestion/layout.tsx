import type { Metadata } from "next";
import type { ReactNode } from "react";

// La parte de gestión no aparece en buscadores.
export const metadata: Metadata = {
  title: "Gestión · Adela María",
  robots: { index: false, follow: false },
};

export default function LayoutGestion({ children }: { children: ReactNode }) {
  return children;
}
