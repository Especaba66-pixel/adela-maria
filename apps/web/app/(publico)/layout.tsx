import { centro } from "@adela/db";
import { formatearTelefono } from "@adela/dominio";
import Link from "next/link";
import type { ReactNode } from "react";
import { Marca } from "@/components/Marca";
import { db } from "@/server/db";

export default async function LayoutPublico({ children }: { children: ReactNode }) {
  const [c] = await db().select().from(centro).limit(1);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-borde bg-superficie">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" aria-label="Inicio">
            <Marca />
          </Link>
          <Link
            href="/reservar"
            className="inline-flex min-h-toque items-center rounded-xl bg-dorado-oscuro px-5 font-semibold text-white hover:bg-tinta"
          >
            Pedir cita
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-borde bg-crema">
        <div className="mx-auto max-w-3xl space-y-1 px-4 py-6 text-tinta-suave">
          <div className="font-titulo text-xl text-dorado-oscuro">Adela María · Belleza holística</div>
          {c?.direccion && <div>{c.direccion}</div>}
          {c?.telefono && (
            <div>
              <a href={`tel:${c.telefono}`} className="underline">
                {c.telefono.startsWith("+34") ? formatearTelefono(c.telefono) : c.telefono}
              </a>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
