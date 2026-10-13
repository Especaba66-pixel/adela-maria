import { stock } from "@adela/db";
import { NOMBRE_CATEGORIA_GASTO, formatearEuros, textoPorcentaje, trimestre } from "@adela/dominio";
import { Boton, Tarjeta } from "@adela/ui";
import Link from "next/link";
import { requerirSesion } from "@/server/auth";
import { listaProveedores, trimestreFiscal } from "@/server/stock";
import { anular } from "./acciones";
import { FormularioGasto } from "./Formulario";

/** «2026-T4» → una fecha de ese trimestre. */
const fechaDe = (t?: string) => {
  const m = t?.match(/^(\d{4})-T([1-4])$/);
  return m ? `${m[1]}-${String((Number(m[2]) - 1) * 3 + 1).padStart(2, "0")}-15` : stock.hoy();
};
const vecino = (fecha: string, meses: number) => {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + meses);
  return trimestre(d.toISOString().slice(0, 10)).nombre;
};

export default async function Gastos({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  await requerirSesion("gastos.gestionar");
  const fecha = fechaDe((await searchParams).t);
  const [datos, proveedores] = await Promise.all([trimestreFiscal(fecha), listaProveedores()]);
  const { trimestre: t, resumen: r } = datos;
  const [anio, num] = t.nombre.split("-T");
  return (
    <div className="max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-4xl">Gastos</h1>
        <Link href={`?t=${vecino(fecha, -3)}`} className="inline-flex min-h-toque items-center rounded-xl border-2 border-borde px-4" aria-label="Trimestre anterior">
          ←
        </Link>
        <span className="text-xl font-semibold" data-testid="trimestre">
          {num}º trimestre de {anio}
        </span>
        <Link href={`?t=${vecino(fecha, 3)}`} className="inline-flex min-h-toque items-center rounded-xl border-2 border-borde px-4" aria-label="Trimestre siguiente">
          →
        </Link>
      </header>

      <section aria-label="Resumen del trimestre" className="grid gap-4 sm:grid-cols-3">
        <Tarjeta>
          <div className="text-tinta-suave">Gastos (con IVA)</div>
          <div className="font-titulo text-4xl" data-testid="total-gastos">
            {formatearEuros(r.gastosTotal)}
          </div>
        </Tarjeta>
        <Tarjeta>
          <div className="text-tinta-suave">IVA de las ventas (repercutido)</div>
          <div className="font-titulo text-4xl">{formatearEuros(r.ivaRepercutido)}</div>
        </Tarjeta>
        <Tarjeta>
          <div className="text-tinta-suave">IVA de los gastos (soportado)</div>
          <div className="font-titulo text-4xl" data-testid="iva-soportado">
            {formatearEuros(r.ivaSoportado)}
          </div>
        </Tarjeta>
      </section>
      <p className="text-tinta-suave">
        Diferencia orientativa: {formatearEuros(r.ivaRepercutido - r.ivaSoportado)}. El cálculo oficial (modelo 303) lo hace la gestoría.{" "}
        <a href={`/gestion/mas/gastos/exportar?t=${t.nombre}`} className="font-semibold text-dorado-oscuro underline">
          Descargar el trimestre para la gestoría (Excel)
        </a>
      </p>

      <details className="rounded-tarjeta border border-borde bg-superficie p-6" open={datos.gastos.length === 0}>
        <summary className="cursor-pointer text-2xl">Anotar un gasto</summary>
        <div className="pt-4">
          <FormularioGasto hoy={stock.hoy()} proveedores={proveedores.map(({ p }) => ({ id: p.id, nombre: p.nombre }))} />
        </div>
      </details>

      <Tarjeta className="divide-y divide-borde p-0">
        <h2 className="px-6 py-3 text-2xl">Gastos del trimestre</h2>
        {datos.gastos.length === 0 && <p className="px-6 py-3 text-tinta-suave">No hay gastos anotados en este trimestre.</p>}
        {datos.gastos.map(({ g, proveedor }) => (
          <div key={g.id} className={`flex flex-wrap items-center justify-between gap-3 px-6 py-3 ${g.anuladoEn ? "opacity-50" : ""}`}>
            <span>
              <span className="font-semibold">{g.concepto}</span>
              <span className="text-tinta-suave">
                {" "}
                · {g.fecha.split("-").reverse().join("/")} · {NOMBRE_CATEGORIA_GASTO[g.categoria]}
                {proveedor && ` · ${proveedor}`} · IVA {textoPorcentaje(g.ivaCentesimas)}
                {g.pagoCaja && " · pagado con la caja"}
                {g.anuladoEn && " · anulado"}
              </span>
            </span>
            <span className="flex items-center gap-3">
              <span className="font-semibold">{formatearEuros(g.total)}</span>
              {!g.anuladoEn && !g.compraId && (
                <form action={anular}>
                  <input type="hidden" name="id" value={g.id} />
                  <Boton type="submit" variante="discreto" className="min-h-10 px-2 text-sm">
                    Anular
                  </Boton>
                </form>
              )}
            </span>
          </div>
        ))}
      </Tarjeta>
    </div>
  );
}
