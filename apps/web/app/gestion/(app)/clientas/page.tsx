import { formatearTelefono } from "@adela/dominio";
import { Aviso, Tarjeta } from "@adela/ui";
import Link from "next/link";
import { buscarClientas } from "@/server/clientas";

export default async function Clientas({ searchParams }: { searchParams: Promise<{ q?: string; suprimida?: string }> }) {
  const { q = "", suprimida } = await searchParams;
  const lista = await buscarClientas(q, 100);
  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-4xl">Clientas</h1>
        <Link href="/gestion/clientas/nueva" className="inline-flex min-h-toque items-center rounded-xl bg-dorado-oscuro px-5 font-semibold text-white hover:bg-tinta">
          + Nueva clienta
        </Link>
      </header>
      {suprimida && <Aviso prioridad="correcto">Datos de la clienta eliminados.</Aviso>}
      <form method="get" role="search">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Buscar por nombre o teléfono…"
          aria-label="Buscar clienta"
          className="block w-full min-h-boton rounded-xl border-2 border-borde bg-superficie px-4 text-xl focus:border-dorado"
        />
      </form>
      {lista.length === 0 ? (
        <p className="text-tinta-suave">{q ? "No hay ninguna clienta con ese nombre o teléfono." : "Todavía no hay clientas."}</p>
      ) : (
        <Tarjeta className="divide-y divide-borde p-0">
          {lista.map((c) => (
            <Link key={c.id} href={`/gestion/clientas/${c.id}`} className="flex min-h-boton items-center justify-between gap-4 px-6 hover:bg-crema">
              <span className="text-lg font-medium">{c.nombre}</span>
              <span className="text-tinta-suave">{c.telefono ? formatearTelefono(c.telefono) : "sin teléfono"}</span>
            </Link>
          ))}
        </Tarjeta>
      )}
    </div>
  );
}
