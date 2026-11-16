import { NOMBRE_USO, aCsv, euros, hoyEnMadrid, nombreMes, periodoDeMes } from "@adela/dominio";
import { requerirSesion } from "@/server/auth";
import { inventarioDelMes } from "@/server/stock";

/** El stock del mes para la asesoría: existencias al empezar, entradas, salidas y existencias al acabar, valoradas. */
export async function GET(req: Request) {
  await requerirSesion("stock.gestionar");
  const q = new URL(req.url).searchParams.get("mes") ?? "";
  const mes = periodoDeMes(q) ? q : hoyEnMadrid(new Date()).slice(0, 7);
  const p = periodoDeMes(mes)!;
  const d = await inventarioDelMes(p.desde, p.hasta);
  const n = (v: number) => String(v);
  const filas: (string | number | null)[][] = [
    [`Adela María · Belleza holística · Stock de ${nombreMes(mes)} (del ${p.desde} al ${p.hasta})`],
    ["Valorado al último coste de compra, sin IVA. Las salidas por venta son netas de devoluciones."],
    [],
    ["Producto", "Para", "Referencia", "Proveedor", "Existencias al empezar", "Entradas (compras)", "Salidas por venta", "Gastado en cabina", "Mermas", "Ajustes", "Existencias al acabar", "Coste unitario", "Valor al acabar"],
    ...d.filas.map((f) => [
      f.p.nombre,
      NOMBRE_USO[f.p.uso],
      f.p.referencia ?? "",
      f.proveedor ?? "",
      n(f.ini),
      n(f.entradas),
      n(f.ventas),
      n(f.consumo),
      n(f.mermas),
      n(f.ajustes),
      n(f.final),
      f.p.costeCentimos === null ? "" : euros(f.p.costeCentimos),
      f.valor === null ? "" : euros(f.valor),
    ]),
    [],
    ["Valor total del stock al acabar el mes", "", "", "", "", "", "", "", "", "", "", "", euros(d.valorTotal)],
    ...(d.sinCoste > 0 ? [[`${d.sinCoste} producto(s) con existencias no tienen coste de compra y no suman en el valor.`]] : []),
  ];
  return new Response(aCsv(filas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="adela-maria-stock-${mes}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
