"use client";
import { clases } from "@adela/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MENU } from "./menu";

export function Navegacion() {
  const ruta = usePathname();
  return (
    <nav aria-label="Menú principal" className="flex flex-col gap-1">
      {MENU.map((e) => {
        const activa = e.href === "/" ? ruta === "/" : ruta.startsWith(e.href);
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activa ? "page" : undefined}
            className={clases(
              "flex min-h-boton items-center gap-4 rounded-xl px-4 text-lg font-medium transition-colors",
              activa ? "bg-dorado-oscuro text-white" : "text-tinta hover:bg-crema",
            )}
          >
            <span aria-hidden className="w-7 text-center text-2xl">
              {e.icono}
            </span>
            {e.nombre}
          </Link>
        );
      })}
    </nav>
  );
}
