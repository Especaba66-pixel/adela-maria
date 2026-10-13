import { NOMBRE_SEGMENTO, SEGMENTOS, formatearTelefono, type Segmento } from "@adela/dominio";
import { Aviso, Tarjeta } from "@adela/ui";
import Link from "next/link";
import { enlaceMensaje } from "@/components/ListaAvisos";
import { buscarClientas, clientasDeSegmento } from "@/server/clientas";

/** Qué mensaje se ofrece en cada segmento (los demás, sin botón: se escribe desde la ficha). */
const MENSAJE_SEGMENTO: Partial<Record<Segmento, string>> = { inactivas: "te_echamos_de_menos", cumpleanos_mes: "cumpleanos" };

const chip = "inline-flex min-h-10 items-center rounded-full border-2 px-4 text-sm font-semibold";

export default async function Clientas({ searchParams }: { searchParams: Promise<{ q?: string; suprimida?: string; segmento?: string }> }) {
  const { q = "", suprimida, segmento: s } = await searchParams;
  const segmento = (SEGMENTOS as readonly string[]).includes(s ?? "") ? (s as Segmento) : null;
  const lista = segmento ? await clientasDeSegmento(segmento) : (await buscarClientas(q, 100)).map((c) => ({ ...c, dato: null as string | null, promociones: false }));
  const plantilla = segmento ? MENSAJE_SEGMENTO[segmento] : undefined;
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
      <nav aria-label="Grupos de clientas" className="flex flex-wrap gap-2">
        <Link href="/gestion/clientas" className={`${chip} ${segmento ? "border-borde" : "border-dorado bg-dorado text-white"}`} aria-current={segmento ? undefined : "page"}>
          Todas
        </Link>
        {SEGMENTOS.map((g) => (
          <Link key={g} href={`/gestion/clientas?segmento=${g}`} className={`${chip} ${segmento === g ? "border-dorado bg-dorado text-white" : "border-borde hover:bg-crema"}`} aria-current={segmento === g ? "page" : undefined}>
            {NOMBRE_SEGMENTO[g]}
          </Link>
        ))}
      </nav>
      {segmento && (
        <p className="text-tinta-suave">
          {lista.length} {lista.length === 1 ? "clienta" : "clientas"}
          {plantilla && " · el botón de WhatsApp sale solo a quien acepta promociones"}
        </p>
      )}
      {lista.length === 0 ? (
        <p className="text-tinta-suave">{segmento ? "No hay ninguna clienta en este grupo." : q ? "No hay ninguna clienta con ese nombre o teléfono." : "Todavía no hay clientas."}</p>
      ) : (
        <Tarjeta className="divide-y divide-borde p-0">
          {lista.map((c) => (
            <div key={c.id} className="flex min-h-boton flex-wrap items-center gap-x-4 gap-y-1 px-6 py-2 hover:bg-crema">
              <Link href={`/gestion/clientas/${c.id}`} className="mr-auto text-lg font-medium underline-offset-4 hover:underline">
                {c.nombre}
              </Link>
              {c.dato && <span className="text-sm text-tinta-suave">{c.dato}</span>}
              <span className="text-tinta-suave">{c.telefono ? formatearTelefono(c.telefono) : "sin teléfono"}</span>
              {plantilla && c.telefono && c.promociones && (
                <a href={enlaceMensaje({ clienteId: c.id, plantilla })} target="_blank" rel="noopener" className="inline-flex min-h-10 items-center rounded-lg bg-correcto px-3 text-sm font-semibold text-white hover:opacity-90">
                  WhatsApp
                </a>
              )}
            </div>
          ))}
        </Tarjeta>
      )}
    </div>
  );
}
