import { centro } from "@adela/db";
import { esFecha, formatearEuros, hoyEnMadrid, nombreMes, sumarDias } from "@adela/dominio";
import { Tarjeta } from "@adela/ui";
import Link from "next/link";
import { diaLargo } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { serviciosDelPeriodo } from "@/server/informes";

const enlace = "inline-flex min-h-toque items-center rounded-xl border-2 border-borde bg-superficie px-4 font-medium";
const enlaceMarca = "inline-flex min-h-toque items-center rounded-xl border-2 border-dorado-oscuro px-4 font-semibold text-dorado-oscuro hover:bg-crema";

/** Lo cobrado en un día, línea a línea (servicios, productos y bonos), para revisarlo o mandarlo a la asesoría. */
export default async function ServiciosDelDia({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  await requerirSesion("informes.ver");
  const hoy = hoyEnMadrid(new Date());
  const q = await searchParams;
  const dia = q.dia && esFecha(q.dia) && q.dia <= hoy ? q.dia : hoy;
  const mes = dia.slice(0, 7);
  const [lineas, [c]] = await Promise.all([serviciosDelPeriodo(dia, dia), db().select({ correo: centro.correoAsesoria }).from(centro).limit(1)]);
  const e = formatearEuros;
  const total = lineas.reduce((s, l) => s + l.total, 0);
  const porTipo = (["Servicio", "Producto", "Bono", "Otro"] as const)
    .map((t) => ({ t, importe: lineas.filter((l) => l.tipo === t).reduce((s, l) => s + l.total, 0), n: lineas.filter((l) => l.tipo === t).length }))
    .filter((x) => x.n > 0);
  const correo = c?.correo ?? "";
  const mailto = correo
    ? `mailto:${encodeURIComponent(correo)}?subject=${encodeURIComponent(`Servicios de ${nombreMes(mes)} · Adela María Belleza holística`)}&body=${encodeURIComponent(`Hola,\n\nTe paso los servicios y ventas de ${nombreMes(mes)}, línea a línea y con el total de cada día.\n\nAdjunto el archivo (adela-maria-servicios-${mes}.csv).\n\nUn saludo.`)}`
    : null;
  const url = (d: string) => `/gestion/mas/informes/servicios?dia=${d}`;

  return (
    <div className="max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-4xl first-letter:uppercase">{diaLargo(dia)}</h1>
        <Link href="/gestion/mas/informes" className={enlace}>
          ‹ Informes
        </Link>
      </header>

      <nav aria-label="Elegir el día" className="flex flex-wrap items-end gap-3">
        <Link href={url(sumarDias(dia, -1))} className={enlace} aria-label="Día anterior">
          ‹
        </Link>
        <Link href={url(hoy)} className={enlace}>
          Hoy
        </Link>
        {dia < hoy && (
          <Link href={url(sumarDias(dia, 1))} className={enlace} aria-label="Día siguiente">
            ›
          </Link>
        )}
        <form method="get" aria-label="Ir a un día" className="flex items-end gap-2">
          <label className="font-medium">
            Ir al día
            <input name="dia" type="date" max={hoy} defaultValue={dia} className="mt-1 block min-h-toque rounded-xl border-2 border-borde bg-white px-3" />
          </label>
          <button type="submit" className={enlace}>
            Ver
          </button>
        </form>
      </nav>

      {lineas.length === 0 ? (
        <p className="text-tinta-suave">No hay ventas este día.</p>
      ) : (
        <>
          <p className="text-lg" data-testid="total-dia">
            Total del día: <strong>{e(total)}</strong>
            {porTipo.map((x) => ` · ${x.t === "Servicio" ? "Servicios" : x.t === "Producto" ? "Productos" : x.t === "Bono" ? "Bonos" : "Otros"} ${e(x.importe)}`).join("")}
          </p>
          <Tarjeta className="overflow-x-auto p-0">
            <table className="w-full text-left">
              <thead className="border-b border-borde text-sm text-tinta-suave">
                <tr>
                  <th className="px-4 py-3 font-normal">Hora</th>
                  <th className="px-4 py-3 font-normal">Clienta</th>
                  <th className="px-4 py-3 font-normal">Concepto</th>
                  <th className="px-4 py-3 text-right font-normal">Cant.</th>
                  <th className="px-4 py-3 text-right font-normal">Total</th>
                  <th className="px-4 py-3 font-normal">Pago</th>
                  <th className="px-4 py-3 font-normal">Factura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {lineas.map((l, i) => (
                  <tr key={i} className={l.devolucion ? "text-urgente" : ""}>
                    <td className="px-4 py-2">{l.hora}</td>
                    <td className="px-4 py-2">{l.clienta ?? "—"}</td>
                    <td className="px-4 py-2">
                      {l.descripcion}
                      <span className="ml-2 text-sm text-tinta-suave">{l.tipo}</span>
                    </td>
                    <td className="px-4 py-2 text-right">{l.cantidad}</td>
                    <td className="px-4 py-2 text-right font-semibold">{e(l.total)}</td>
                    <td className="px-4 py-2">{l.pago}</td>
                    <td className="px-4 py-2 text-sm text-tinta-suave">{l.factura ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
        </>
      )}

      <section aria-label="Para la asesoría" className="flex flex-wrap items-center gap-3 rounded-xl border border-borde bg-superficie p-4">
        <a href={`/gestion/mas/informes/servicios/exportar?dia=${dia}`} className={enlaceMarca}>
          Descargar este día (Excel)
        </a>
        <a href={`/gestion/mas/informes/servicios/exportar?mes=${mes}`} className={enlaceMarca}>
          Descargar {nombreMes(mes)} entero (Excel)
        </a>
        {mailto ? (
          <a href={mailto} className={enlaceMarca}>
            Escribir a la asesoría (mes)
          </a>
        ) : (
          <span className="text-sm text-tinta-suave">Para abrir el correo ya redactado, pon el correo de la asesoría en Configuración → Datos del centro.</span>
        )}
        <span className="basis-full text-sm text-tinta-suave">El archivo del mes lleva todas las líneas con el total de cada día y el total del mes. Descárgalo y adjúntalo al correo.</span>
      </section>
    </div>
  );
}
