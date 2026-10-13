"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

/** En el móvil: barra de arriba con el logo y un botón que despliega el menú (se cierra al cambiar de pantalla). */
export function MenuMovil({ marca, children }: { marca: ReactNode; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();
  useEffect(() => setAbierto(false), [ruta]);
  return (
    <div className="lg:hidden">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-borde bg-superficie px-4 py-2">
        <div className="w-36">{marca}</div>
        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          className="inline-flex min-h-toque items-center gap-2 rounded-xl border-2 border-borde px-4 font-semibold"
        >
          <span aria-hidden>{abierto ? "✕" : "☰"}</span> Menú
        </button>
      </header>
      {abierto && <div className="fixed inset-x-0 bottom-0 top-[4.25rem] z-20 overflow-y-auto bg-superficie p-4">{children}</div>}
    </div>
  );
}
