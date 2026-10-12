import { cobros } from "@adela/db";
import { NOMBRE_ESTADO_BONO, estadoTarjeta, formatearEuros, NOMBRE_ESTADO_TARJETA, textoQuedan } from "@adela/dominio";
import { Aviso, Boton, Tarjeta } from "@adela/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requerirSesion } from "@/server/auth";
import { listaBonos, listaTarjetas } from "@/server/bonos";
import { db } from "@/server/db";

export default async function Bonos({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  await requerirSesion("cobrar");
  const { codigo } = await searchParams;
  if (codigo) {
    const t = await cobros.tarjetaRegalo(db(), { codigo });
    if (t) redirect(`/gestion/tpv/vale/${t.id}`);
  }
  const [bonos, tarjetas] = await Promise.all([listaBonos(), listaTarjetas()]);
  const activos = bonos.filter((b) => b.estado === "activo");
  const otros = bonos.filter((b) => b.estado !== "activo");
  const fila = (b: (typeof bonos)[number]) => (
    <Link key={b.id} href={`/gestion/mas/bonos/${b.id}`} className="flex min-h-toque flex-wrap items-center justify-between gap-2 px-6 py-2 hover:bg-crema">
      <span>
        <span className="font-semibold">{b.clienta}</span> · {b.nombre}
      </span>
      <span>{b.estado === "activo" ? `Le ${textoQuedan(b.sesiones - b.usadas)}` : NOMBRE_ESTADO_BONO[b.estado]}</span>
    </Link>
  );
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-4xl">Bonos y tarjetas regalo</h1>

      <Tarjeta>
        <form className="flex flex-wrap items-end gap-3">
          <label className="grow">
            Consultar una tarjeta regalo
            <input name="codigo" defaultValue={codigo} placeholder="AM-XXXX-XXXX" className="mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg uppercase" />
          </label>
          <Boton type="submit" variante="secundario">
            Consultar
          </Boton>
        </form>
        {codigo && <div className="mt-3"><Aviso prioridad="urgente">No existe ninguna tarjeta regalo con ese código.</Aviso></div>}
      </Tarjeta>

      <section aria-label="Bonos activos" className="space-y-2">
        <h2 className="text-2xl">Bonos activos ({activos.length})</h2>
        {activos.length === 0 ? <p className="text-tinta-suave">No hay bonos activos. Se venden desde el TPV.</p> : <Tarjeta className="divide-y divide-borde p-0">{activos.map(fila)}</Tarjeta>}
      </section>

      {otros.length > 0 && (
        <details>
          <summary className="min-h-toque cursor-pointer text-xl">Bonos agotados, caducados o anulados ({otros.length})</summary>
          <Tarjeta className="mt-2 divide-y divide-borde p-0">{otros.map(fila)}</Tarjeta>
        </details>
      )}

      <section aria-label="Tarjetas regalo" className="space-y-2">
        <h2 className="text-2xl">Tarjetas regalo</h2>
        {tarjetas.length === 0 ? (
          <p className="text-tinta-suave">Todavía no se ha vendido ninguna. Se venden desde el TPV.</p>
        ) : (
          <Tarjeta className="divide-y divide-borde p-0">
            {tarjetas.map((t) => (
              <Link key={t.id} href={`/gestion/tpv/vale/${t.id}`} className="flex min-h-toque flex-wrap items-center justify-between gap-2 px-6 py-2 hover:bg-crema">
                <span>
                  <span className="font-mono font-semibold">{t.codigo}</span>
                  {t.para && <span className="text-tinta-suave"> · para {t.para}</span>}
                </span>
                <span>
                  {NOMBRE_ESTADO_TARJETA[estadoTarjeta({ saldo: t.saldo, anulada: t.anuladaEn !== null })]} · {formatearEuros(t.saldo)} de {formatearEuros(t.importeInicial)}
                </span>
              </Link>
            ))}
          </Tarjeta>
        )}
      </section>
    </div>
  );
}
