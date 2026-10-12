import { cobros, sesionesCaja, usuarios } from "@adela/db";
import { NOMBRE_METODO, formatearEuros, METODOS_PAGO } from "@adela/dominio";
import { Aviso, Tarjeta } from "@adela/ui";
import { desc, eq, isNotNull } from "drizzle-orm";
import { fechaHora } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { AbrirCaja, BotonCajon, CerrarCaja, MovimientoCaja } from "./Paneles";

const TIPO = { fondo: "Fondo inicial", venta: "Cobro", devolucion: "Devolución", entrada: "Entrada", salida: "Salida" };

export default async function Caja({ searchParams }: { searchParams: Promise<{ cierre?: string }> }) {
  await requerirSesion("caja.abrir_cerrar");
  const { cierre } = await searchParams;
  const diferencia = cierre !== undefined && /^-?\d+$/.test(cierre) ? Number(cierre) : null;
  const abierta = await cobros.cajaAbierta(db());
  const anteriores = await db()
    .select({ s: sesionesCaja, quien: usuarios.nombre })
    .from(sesionesCaja)
    .innerJoin(usuarios, eq(usuarios.id, sesionesCaja.cerradaPor))
    .where(isNotNull(sesionesCaja.cerradaEn))
    .orderBy(desc(sesionesCaja.cerradaEn))
    .limit(10);

  if (!abierta) {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl">Caja</h1>
        {diferencia !== null && (
          <Aviso prioridad={diferencia === 0 ? "correcto" : "importante"}>
            {diferencia === 0
              ? "Caja cerrada. Cuadra al céntimo."
              : `Caja cerrada con ${diferencia > 0 ? "sobrante" : "faltante"} de ${formatearEuros(Math.abs(diferencia))}.`}
          </Aviso>
        )}
        <AbrirCaja sugerido={anteriores[0]?.s.efectivoContado ?? 0} />
        <Historial anteriores={anteriores} />
      </div>
    );
  }
  const r = await cobros.resumenCaja(db(), abierta.id);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-4xl">Caja abierta</h1>
        <BotonCajon />
      </header>
      <p className="text-tinta-suave">Desde el {fechaHora(abierta.abiertaEn)}.</p>
      <section aria-label="Resumen de la caja" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Tarjeta>
          <div className="text-tinta-suave">Efectivo en el cajón</div>
          <div className="font-titulo text-4xl" data-testid="efectivo-esperado">{formatearEuros(r.esperado)}</div>
        </Tarjeta>
        {METODOS_PAGO.map((m) => (
          <Tarjeta key={m}>
            <div className="text-tinta-suave">Cobrado con {NOMBRE_METODO[m].toLowerCase()}</div>
            <div className="font-titulo text-4xl">{formatearEuros(r.porMetodo[m])}</div>
          </Tarjeta>
        ))}
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <MovimientoCaja />
        <CerrarCaja esperado={r.esperado} />
      </div>
      <Tarjeta className="divide-y divide-borde p-0">
        <h2 className="px-6 py-3 text-2xl">Movimientos de efectivo</h2>
        {r.movimientos.map((m) => (
          <div key={m.id} className="flex justify-between gap-4 px-6 py-3">
            <span>
              {fechaHora(m.cuando).slice(-8, -3)} · {TIPO[m.tipo]}
              {m.concepto && <span className="text-tinta-suave"> · {m.concepto}</span>}
            </span>
            <span className={m.importe < 0 ? "text-urgente" : ""}>{formatearEuros(m.importe)}</span>
          </div>
        ))}
      </Tarjeta>
    </div>
  );
}

function Historial({ anteriores }: { anteriores: { s: typeof sesionesCaja.$inferSelect; quien: string }[] }) {
  if (anteriores.length === 0) return null;
  return (
    <Tarjeta className="divide-y divide-borde p-0">
      <h2 className="px-6 py-3 text-2xl">Últimos cierres</h2>
      {anteriores.map(({ s, quien }) => {
        const dif = (s.efectivoContado ?? 0) - (s.efectivoEsperado ?? 0);
        return (
          <div key={s.id} className="flex flex-wrap justify-between gap-2 px-6 py-3">
            <span>
              {fechaHora(s.cerradaEn!)} · cerró {quien}
            </span>
            <span>
              Contado {formatearEuros(s.efectivoContado ?? 0)} ·{" "}
              <span className={dif === 0 ? "text-correcto" : "text-urgente"}>{dif === 0 ? "cuadra" : `${dif > 0 ? "+" : ""}${formatearEuros(dif)}`}</span>
            </span>
          </div>
        );
      })}
    </Tarjeta>
  );
}
