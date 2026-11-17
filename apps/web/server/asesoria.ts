import "server-only";
import { centro } from "@adela/db";
import { NOMBRE_CATEGORIA_GASTO, NOMBRE_USO, formatearEuros, nombreMes, periodoDeMes, textoPorcentaje, trimestre as trimestreDe } from "@adela/dominio";
import { db } from "./db";
import { serviciosDelPeriodo } from "./informes";
import { crearPdf, type Documento, type Fila } from "./pdf";
import { inventarioDelMes, trimestreFiscal } from "./stock";

/**
 * Los papeles del mes para la asesoría, en PDF: servicios y ventas, stock y trimestre (facturas, gastos e IVA).
 * Llevan lo mismo que los archivos de Excel, en tablas para leer o imprimir.
 */

export type DocAsesoria = "servicios" | "stock" | "trimestre";
export const DOCS_ASESORIA: DocAsesoria[] = ["servicios", "stock", "trimestre"];

const e = formatearEuros;
/** «2026-11-05» → «05/11/2026». */
/** «noviembre de 2026» → «Noviembre de 2026». */
const mesTitulo = (mes: string) => nombreMes(mes).replace(/^./, (c) => c.toUpperCase());
const fecha = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const TIPO_FACTURA = { simplificada: "Ticket", completa: "Factura", rectificativa: "Rectificativa" } as const;

async function emisor() {
  const [c] = await db().select({ nombreFiscal: centro.nombreFiscal, nif: centro.nif }).from(centro).limit(1);
  return ["Adela María · Belleza holística", c?.nombreFiscal, c?.nif ? `NIF ${c.nif}` : null].filter(Boolean).join(" · ");
}

async function servicios(mes: string): Promise<Documento> {
  const p = periodoDeMes(mes)!;
  const lineas = await serviciosDelPeriodo(p.desde, p.hasta);
  const suma = (ls: typeof lineas, k: "base" | "iva" | "total") => ls.reduce((s, l) => s + l[k], 0);
  const filas: Fila[] = [];
  for (const dia of [...new Set(lineas.map((l) => l.fecha))]) {
    const delDia = lineas.filter((l) => l.fecha === dia);
    for (const l of delDia) {
      filas.push({ celdas: [fecha(l.fecha), l.hora, l.factura ?? "", l.clienta ?? "", l.tipo, l.descripcion, String(l.cantidad), e(l.base), e(l.iva), e(l.total), l.pago] });
    }
    filas.push({ total: true, celdas: ["", "", "", "", "", `Total del ${fecha(dia)}`, "", e(suma(delDia, "base")), e(suma(delDia, "iva")), e(suma(delDia, "total")), ""] });
  }
  const tipos = (["Servicio", "Producto", "Bono", "Otro"] as const).map((t) => ({ t, ls: lineas.filter((l) => l.tipo === t) })).filter((x) => x.ls.length);
  const nombreTipo = { Servicio: "Servicios", Producto: "Productos", Bono: "Bonos", Otro: "Otros" } as const;
  return {
    titulo: "Servicios y ventas",
    subtitulo: `${mesTitulo(mes)} (del ${fecha(p.desde)} al ${fecha(p.hasta)})`,
    emisor: await emisor(),
    secciones: [
      {
        titulo: "Resumen del mes",
        columnas: [
          { titulo: "Concepto", ancho: 4 },
          { titulo: "Líneas", ancho: 1, derecha: true },
          { titulo: "Base", ancho: 1.2, derecha: true },
          { titulo: "IVA", ancho: 1.2, derecha: true },
          { titulo: "Total", ancho: 1.2, derecha: true },
        ],
        filas: [
          ...tipos.map(({ t, ls }) => ({ celdas: [nombreTipo[t], String(ls.length), e(suma(ls, "base")), e(suma(ls, "iva")), e(suma(ls, "total"))] })),
          { total: true, celdas: ["Total del mes", String(lineas.length), e(suma(lineas, "base")), e(suma(lineas, "iva")), e(suma(lineas, "total"))] },
        ],
        vacio: "No hay ventas este mes.",
      },
      {
        titulo: "Detalle por día",
        columnas: [
          { titulo: "Fecha", ancho: 1.15 },
          { titulo: "Hora", ancho: 0.65 },
          { titulo: "Factura", ancho: 1.3 },
          { titulo: "Clienta", ancho: 1.9 },
          { titulo: "Tipo", ancho: 0.95 },
          { titulo: "Concepto", ancho: 2.6 },
          { titulo: "Cant.", ancho: 0.55, derecha: true },
          { titulo: "Base", ancho: 1, derecha: true },
          { titulo: "IVA", ancho: 0.9, derecha: true },
          { titulo: "Total", ancho: 1, derecha: true },
          { titulo: "Pago", ancho: 1.9 },
        ],
        filas,
        vacio: "No hay ventas este mes.",
        nota: lineas.some((l) => l.devolucion) ? "Las devoluciones salen en negativo." : undefined,
      },
    ],
  };
}

async function stock(mes: string): Promise<Documento> {
  const p = periodoDeMes(mes)!;
  const d = await inventarioDelMes(p.desde, p.hasta);
  return {
    titulo: "Stock del mes",
    subtitulo: `${mesTitulo(mes)} (del ${fecha(p.desde)} al ${fecha(p.hasta)})`,
    emisor: await emisor(),
    secciones: [
      {
        titulo: "Existencias, entradas y salidas por producto",
        columnas: [
          { titulo: "Producto", ancho: 3 },
          { titulo: "Para", ancho: 1.1 },
          { titulo: "Proveedor", ancho: 1.7 },
          { titulo: "Al empezar", ancho: 0.95, derecha: true },
          { titulo: "Entradas", ancho: 0.85, derecha: true },
          { titulo: "Vendido", ancho: 0.85, derecha: true },
          { titulo: "En cabina", ancho: 0.85, derecha: true },
          { titulo: "Mermas", ancho: 0.8, derecha: true },
          { titulo: "Ajustes", ancho: 0.8, derecha: true },
          { titulo: "Al acabar", ancho: 0.9, derecha: true },
          { titulo: "Coste u.", ancho: 0.95, derecha: true },
          { titulo: "Valor", ancho: 1.05, derecha: true },
        ],
        filas: [
          ...d.filas.map((f) => ({
            celdas: [
              f.p.nombre,
              NOMBRE_USO[f.p.uso],
              f.proveedor ?? "",
              String(f.ini),
              String(f.entradas),
              String(f.ventas),
              String(f.consumo),
              String(f.mermas),
              String(f.ajustes),
              String(f.final),
              f.p.costeCentimos === null ? "" : e(f.p.costeCentimos),
              f.valor === null ? "" : e(f.valor),
            ],
          })),
          { total: true, celdas: ["Valor total del stock al acabar el mes", "", "", "", "", "", "", "", "", "", "", e(d.valorTotal)] },
        ],
        vacio: "No hay productos.",
        nota:
          "Valorado al último coste de compra, sin IVA. «Vendido» es neto de devoluciones." +
          (d.sinCoste > 0 ? ` ${d.sinCoste} producto(s) con existencias no tienen coste de compra y no suman en el valor.` : ""),
      },
    ],
  };
}

async function trimestre(mes: string): Promise<Documento> {
  const d = await trimestreFiscal(`${mes}-15`);
  const r = d.resumen;
  const vigentes = d.gastos.filter(({ g }) => !g.anuladoEn);
  return {
    titulo: `Trimestre ${d.trimestre.nombre.slice(-2)} de ${d.trimestre.nombre.slice(0, 4)}`,
    subtitulo: `Facturas emitidas, gastos e IVA (del ${fecha(d.trimestre.desde)} al ${fecha(d.trimestre.hasta)})`,
    emisor: await emisor(),
    secciones: [
      {
        titulo: "Resumen de IVA",
        columnas: [
          { titulo: "Concepto", ancho: 4 },
          { titulo: "Importe", ancho: 1.2, derecha: true },
        ],
        filas: [
          { celdas: ["Ventas: base imponible", e(r.ventasBase)] },
          { celdas: ["Ventas: IVA repercutido", e(r.ivaRepercutido)] },
          { celdas: ["Gastos: base imponible", e(r.gastosBase)] },
          { celdas: ["Gastos: IVA soportado", e(r.ivaSoportado)] },
          { total: true, celdas: ["Diferencia orientativa (el modelo 303 lo calcula la asesoría)", e(r.ivaRepercutido - r.ivaSoportado)] },
        ],
      },
      {
        titulo: "Facturas emitidas",
        columnas: [
          { titulo: "Fecha", ancho: 1 },
          { titulo: "Número", ancho: 1.3 },
          { titulo: "Tipo", ancho: 1.1 },
          { titulo: "Cliente", ancho: 2.4 },
          { titulo: "NIF cliente", ancho: 1.2 },
          { titulo: "Base", ancho: 1.1, derecha: true },
          { titulo: "IVA", ancho: 1, derecha: true },
          { titulo: "Total", ancho: 1.1, derecha: true },
        ],
        filas: [
          ...d.facturas.map((f) => {
            const dest = f.destinatario as { nombre?: string; nif?: string } | null;
            return { celdas: [fecha(f.fechaExpedicion), f.numeroCompleto, TIPO_FACTURA[f.tipo], dest?.nombre ?? "", dest?.nif ?? "", e(f.baseTotal), e(f.cuotaTotal), e(f.total)] };
          }),
          {
            total: true,
            celdas: [`${d.facturas.length} facturas`, "", "", "", "", e(r.ventasBase), e(r.ivaRepercutido), e(d.facturas.reduce((s, f) => s + f.total, 0))],
          },
        ],
        vacio: "No hay facturas emitidas en el trimestre.",
      },
      {
        titulo: "Gastos (facturas recibidas)",
        columnas: [
          { titulo: "Fecha", ancho: 1 },
          { titulo: "Nº factura", ancho: 1.2 },
          { titulo: "Proveedor", ancho: 1.9 },
          { titulo: "NIF", ancho: 1.1 },
          { titulo: "Tipo", ancho: 1.3 },
          { titulo: "Concepto", ancho: 2.2 },
          { titulo: "Base", ancho: 1, derecha: true },
          { titulo: "% IVA", ancho: 0.7, derecha: true },
          { titulo: "IVA", ancho: 0.9, derecha: true },
          { titulo: "Total", ancho: 1, derecha: true },
        ],
        filas: [
          ...vigentes.map(({ g, proveedor, nif }) => ({
            celdas: [fecha(g.fecha), g.numeroFactura ?? "", proveedor ?? "", nif ?? "", NOMBRE_CATEGORIA_GASTO[g.categoria], g.concepto, e(g.base), textoPorcentaje(g.ivaCentesimas), e(g.cuota), e(g.total)],
          })),
          { total: true, celdas: [`${vigentes.length} gastos`, "", "", "", "", "", e(r.gastosBase), "", e(r.ivaSoportado), e(r.gastosTotal)] },
        ],
        vacio: "No hay gastos en el trimestre.",
      },
    ],
  };
}

/** El PDF de uno de los papeles del mes, y el nombre con el que se descarga. */
export async function pdfAsesoria(doc: DocAsesoria, mes: string): Promise<{ bytes: Uint8Array; archivo: string }> {
  const documento = doc === "servicios" ? await servicios(mes) : doc === "stock" ? await stock(mes) : await trimestre(mes);
  const sufijo = doc === "trimestre" ? trimestreDe(`${mes}-15`).nombre : mes;
  return { bytes: await crearPdf(documento), archivo: `adela-maria-${doc}-${sufijo}.pdf` };
}
