import { stock } from "@adela/db";
import { NOMBRE_CATEGORIA_GASTO, aCsv, euros } from "@adela/dominio";
import { requerirSesion } from "@/server/auth";
import { trimestreFiscal } from "@/server/stock";

const TIPO = { simplificada: "Factura simplificada", completa: "Factura", rectificativa: "Rectificativa" };

/** Trimestre para la gestoría: facturas emitidas, gastos y resumen de IVA, en un archivo que abre Excel. */
export async function GET(req: Request) {
  await requerirSesion("gastos.gestionar");
  const t = new URL(req.url).searchParams.get("t") ?? "";
  const m = t.match(/^(\d{4})-T([1-4])$/);
  const fecha = m ? `${m[1]}-${String((Number(m[2]) - 1) * 3 + 1).padStart(2, "0")}-15` : stock.hoy();
  const d = await trimestreFiscal(fecha);
  const filas: (string | number | null)[][] = [
    [`Adela María · Belleza holística · ${d.trimestre.nombre} (del ${d.trimestre.desde} al ${d.trimestre.hasta})`],
    [],
    ["RESUMEN DE IVA"],
    ["Ventas: base", euros(d.resumen.ventasBase)],
    ["Ventas: IVA repercutido", euros(d.resumen.ivaRepercutido)],
    ["Gastos: base", euros(d.resumen.gastosBase)],
    ["Gastos: IVA soportado", euros(d.resumen.ivaSoportado)],
    ["Diferencia orientativa", euros(d.resumen.ivaRepercutido - d.resumen.ivaSoportado)],
    [],
    ["FACTURAS EMITIDAS"],
    ["Fecha", "Número", "Tipo", "Cliente", "NIF cliente", "Base", "IVA", "Total"],
    ...d.facturas.map((f) => {
      const dest = f.destinatario as { nombre?: string; nif?: string } | null;
      return [f.fechaExpedicion, f.numeroCompleto, TIPO[f.tipo], dest?.nombre ?? "", dest?.nif ?? "", euros(f.baseTotal), euros(f.cuotaTotal), euros(f.total)];
    }),
    [],
    ["GASTOS (FACTURAS RECIBIDAS)"],
    ["Fecha", "Nº factura", "Proveedor", "NIF proveedor", "Tipo", "Concepto", "Base", "% IVA", "IVA", "Total"],
    ...d.gastos
      .filter(({ g }) => !g.anuladoEn)
      .map(({ g, proveedor, nif }) => [g.fecha, g.numeroFactura ?? "", proveedor ?? "", nif ?? "", NOMBRE_CATEGORIA_GASTO[g.categoria], g.concepto, euros(g.base), euros(g.ivaCentesimas), euros(g.cuota), euros(g.total)]),
  ];
  return new Response(aCsv(filas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="adela-maria-${d.trimestre.nombre}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
