/**
 * Stock, compras y gastos. El stock de un producto es la suma de sus movimientos (entradas en positivo, salidas
 * en negativo). Importes en céntimos.
 */

export const USOS_PRODUCTO = ["venta", "cabina"] as const;
export type UsoProducto = (typeof USOS_PRODUCTO)[number];
export const NOMBRE_USO: Record<UsoProducto, string> = { venta: "Para vender", cabina: "Para cabina" };

export const TIPOS_MOVIMIENTO_STOCK = ["compra", "venta", "devolucion", "consumo", "ajuste", "merma"] as const;
export type TipoMovimientoStock = (typeof TIPOS_MOVIMIENTO_STOCK)[number];
export const NOMBRE_MOVIMIENTO_STOCK: Record<TipoMovimientoStock, string> = {
  compra: "Compra",
  venta: "Venta",
  devolucion: "Devolución de una venta",
  consumo: "Gastado en cabina",
  ajuste: "Recuento",
  merma: "Roto o caducado",
};

export const stockDe = (movimientos: { cantidad: number }[]) => movimientos.reduce((s, m) => s + m.cantidad, 0);

/** Hay que reponer: queda lo mínimo o menos (si el producto tiene mínimo). */
export const stockBajo = (stock: number, minimo: number) => minimo > 0 && stock <= minimo;

export interface DatosProducto {
  nombre: string;
  uso: string;
  referencia?: string;
  precio?: number | null;
  iva?: number | null;
  stockMinimo: number;
}

export function validarProducto(d: DatosProducto): string | null {
  const nombre = d.nombre.trim();
  if (nombre.length < 2 || nombre.length > 80) return "Escribe el nombre del producto.";
  if (!(USOS_PRODUCTO as readonly string[]).includes(d.uso)) return "Elige si es para vender o para cabina.";
  if (!Number.isInteger(d.stockMinimo) || d.stockMinimo < 0 || d.stockMinimo > 100_000) return "Revisa el stock mínimo.";
  if (d.precio != null && (!Number.isInteger(d.precio) || d.precio < 0)) return "Revisa el precio.";
  if (d.iva != null && (!Number.isInteger(d.iva) || d.iva < 0 || d.iva > 10_000)) return "Revisa el IVA.";
  if (d.uso === "venta" && d.precio != null && d.iva == null) return "Un producto con precio necesita su IVA para poder venderse.";
  return null;
}

/** Base y cuota de IVA a partir del total de una factura (IVA incluido). Base + cuota = total siempre. */
export function desglosarTotal(total: number, ivaCentesimas: number): { base: number; cuota: number; total: number } {
  const base = Math.round((total * 10_000) / (10_000 + ivaCentesimas));
  return { base, cuota: total - base, total };
}

/** Totales de una compra: base (suma de líneas sin IVA), cuota y total. */
export function totalCompra(lineas: { cantidad: number; costeUnitario: number }[], ivaCentesimas: number) {
  const base = lineas.reduce((s, l) => s + l.cantidad * l.costeUnitario, 0);
  const cuota = Math.round((base * ivaCentesimas) / 10_000);
  return { base, cuota, total: base + cuota };
}

export const CATEGORIAS_GASTO = ["compras", "alquiler", "suministros", "material", "formacion", "publicidad", "seguros", "gestoria", "otros"] as const;
export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];
export const NOMBRE_CATEGORIA_GASTO: Record<CategoriaGasto, string> = {
  compras: "Compras de producto",
  alquiler: "Alquiler",
  suministros: "Luz, agua, teléfono e internet",
  material: "Material y pequeño equipo",
  formacion: "Formación",
  publicidad: "Publicidad",
  seguros: "Seguros",
  gestoria: "Gestoría y banco",
  otros: "Otros",
};

/** Trimestre natural de una fecha (AAAA-MM-DD): «2026-T4», del 1 de octubre al 31 de diciembre. */
export function trimestre(fecha: string): { nombre: string; desde: string; hasta: string } {
  const anio = Number(fecha.slice(0, 4));
  const t = Math.floor((Number(fecha.slice(5, 7)) - 1) / 3) + 1;
  const mesIni = (t - 1) * 3 + 1;
  const ultimo = new Date(Date.UTC(anio, mesIni + 2, 0)).getUTCDate();
  const mm = (m: number) => String(m).padStart(2, "0");
  return { nombre: `${anio}-T${t}`, desde: `${anio}-${mm(mesIni)}-01`, hasta: `${anio}-${mm(mesIni + 2)}-${ultimo}` };
}

/**
 * Hoja de cálculo en CSV que abre bien Excel en español: separador «;», coma decimal, comillas cuando hacen falta
 * y marca UTF-8 para las tildes. Los importes van en euros con dos decimales.
 */
export function aCsv(filas: (string | number | null)[][]): string {
  const celda = (v: string | number | null) => {
    if (v === null) return "";
    const t = typeof v === "number" ? v.toFixed(2).replace(".", ",") : v;
    return /[;"\n\r]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
  };
  return "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n") + "\r\n";
}

export const euros = (centimos: number) => centimos / 100;
