import { NOMBRE_METODO, aCsv, comprobarCuadre, euros, formatearEuros, hoyEnMadrid, nombreMes, periodoDeMes, type MetodoPago } from "@adela/dominio";
import { requerirSesion } from "@/server/auth";
import { informe } from "@/server/informes";

/** El informe del mes en un archivo que abre Excel. */
export async function GET(req: Request) {
  await requerirSesion("informes.ver");
  const q = new URL(req.url).searchParams.get("mes") ?? "";
  const mes = periodoDeMes(q) ? q : hoyEnMadrid(new Date()).slice(0, 7);
  const p = periodoDeMes(mes)!;
  const d = await informe(p.desde, p.hasta);
  const filas: (string | number | null)[][] = [
    [`Adela María · Belleza holística · Informe de ${nombreMes(mes)}`],
    [],
    ["CUADRE"],
    ...comprobarCuadre(d.cuadre, formatearEuros).map((c) => [c.nombre, c.ok ? "Coincide" : "NO COINCIDE", c.detalle]),
    [],
    ["VENTAS"],
    ["Ventas (menos devoluciones)", euros(d.ventas.total)],
    ["Número de ventas", d.ventas.numero],
    ["Ticket medio", euros(d.ventas.ticketMedio)],
    ["Devoluciones", d.ventas.numDevoluciones, euros(d.ventas.devoluciones)],
    ...d.ventas.porMetodo.map((m) => [`Cobrado con ${NOMBRE_METODO[m.metodo as MetodoPago] ?? m.metodo}`, euros(m.importe)]),
    [],
    ["TRATAMIENTOS"],
    ["Tratamiento", "Cobrados", "Importe", "Sesiones de bono"],
    ...d.tratamientos.map((t) => [t.nombre, t.cantidad, euros(t.total), t.sesionesBono]),
    [],
    ["BONOS VENDIDOS"],
    ["Bono", "Vendidos", "Importe"],
    ...d.bonos.map((b) => [b.nombre, b.cantidad, euros(b.total)]),
    [],
    ["PRODUCTOS"],
    ["Producto", "Unidades", "Importe", "Coste"],
    ...d.productos.map((x) => [x.nombre, x.cantidad, euros(x.total), x.coste === null ? "" : euros(x.coste)]),
    [],
    ["CLIENTAS"],
    ["Nuevas", d.clientas.nuevas],
    ["Atendidas", d.clientas.atendidas],
    ["Citas hechas", d.clientas.realizadas],
    ["No vinieron", d.clientas.noVino],
    ["Canceladas", d.clientas.canceladas],
    [],
    ["EQUIPO Y COMISIONES"],
    ["Profesional", "Citas", "Sesiones de bono", "Servicios sin IVA", "Productos sin IVA", "Comisión"],
    ...d.equipo.map((x) => [x.nombre, x.citas, x.sesionesBono, euros(x.servicios), euros(x.productos), euros(x.comision)]),
    [],
    ["CAJA"],
    ["Abierta", "Por", "Fondo", "Esperado", "Contado"],
    ...d.cajas.map((c) => [c.abiertaEn.toISOString(), c.quien, euros(c.fondo), c.esperado === null ? "" : euros(c.esperado), c.contado === null ? "" : euros(c.contado)]),
    [],
    ["VENTAS POR DÍA"],
    ["Día", "Ventas", "Importe"],
    ...d.ventas.porDia.map((x) => [x.dia, x.numero, euros(x.total)]),
  ];
  return new Response(aCsv(filas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="adela-maria-informe-${mes}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
