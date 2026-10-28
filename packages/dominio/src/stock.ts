import { formatearEuros } from "./dinero";

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

/** Lo que añade una factura de proveedor a la suma de sus líneas. Importes en céntimos. */
export interface AjustesCompra {
  /** Descuento sobre el pedido, sin IVA (el «descuento de pedido» de la factura). */
  descuento?: number;
  /** Total que dice la factura, IVA incluido. Si se indica, manda sobre el IVA calculado: los proveedores redondean
   *  el IVA línea a línea y puede diferir en algún céntimo del calculado sobre la base. */
  totalFactura?: number;
}

/** Totales de una compra: base (suma de líneas sin IVA, menos el descuento), cuota y total. */
export function totalCompra(lineas: { cantidad: number; costeUnitario: number }[], ivaCentesimas: number, ajustes: AjustesCompra = {}) {
  const base = lineas.reduce((s, l) => s + l.cantidad * l.costeUnitario, 0) - (ajustes.descuento ?? 0);
  const cuota = ajustes.totalFactura != null ? ajustes.totalFactura - base : Math.round((base * ivaCentesimas) / 10_000);
  return { base, cuota, total: base + cuota };
}

/**
 * Comprueba el descuento y el total de la factura. Se admite que el IVA de la factura difiera del calculado en un
 * céntimo por línea (redondeos del proveedor), con un mínimo de 5: más que eso suele ser un número mal copiado.
 */
export function errorAjustesCompra(lineas: { cantidad: number; costeUnitario: number }[], ivaCentesimas: number, ajustes: AjustesCompra): string | null {
  const suma = lineas.reduce((s, l) => s + l.cantidad * l.costeUnitario, 0);
  const descuento = ajustes.descuento ?? 0;
  if (!Number.isInteger(descuento) || descuento < 0) return "Revisa el descuento.";
  if (descuento > suma) return "El descuento no puede ser mayor que la suma de los productos.";
  if (ajustes.totalFactura == null) return null;
  if (!Number.isInteger(ajustes.totalFactura) || ajustes.totalFactura < 0) return "Revisa el total de la factura.";
  const base = suma - descuento;
  const calculada = Math.round((base * ivaCentesimas) / 10_000);
  const cuota = ajustes.totalFactura - base;
  if (cuota < 0 || Math.abs(cuota - calculada) > Math.max(5, lineas.length)) {
    return `El total de la factura no cuadra: con esos productos, descuento e IVA debería ser unos ${formatearEuros(base + calculada)}. Revisa las cifras.`;
  }
  return null;
}

/** Coste real de una unidad tras repartir el descuento del pedido en proporción entre todas las líneas. */
export function costeConDescuento(costeUnitario: number, sumaLineas: number, descuento: number): number {
  if (sumaLineas <= 0 || descuento <= 0) return costeUnitario;
  return Math.round((costeUnitario * (sumaLineas - descuento)) / sumaLineas);
}

/**
 * Precio de venta al público (IVA incluido) a partir del coste sin IVA y del margen sobre el coste.
 * Se redondea hacia arriba a los 10 céntimos, para que el margen nunca quede por debajo del pedido.
 */
export function precioConMargen(costeSinIva: number, margenCentesimas: number, ivaCentesimas: number): number {
  const conIva = (costeSinIva * (10_000 + margenCentesimas) * (10_000 + ivaCentesimas)) / 100_000_000;
  return Math.ceil(Math.round(conIva * 1000) / 1000 / 10) * 10;
}

export const CATEGORIAS_GASTO = ["compras", "alquiler", "suministros", "material", "formacion", "publicidad", "seguros", "gestoria", "otros"] as const;
export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];
export const NOMBRE_CATEGORIA_GASTO: Record<CategoriaGasto, string> = {
  compras: "Compras de producto",
  alquiler: "Alquiler",
  suministros: "Luz, agua, teléfono e internet",
  material: "Material del centro (papel camilla, vaselina, algodón, guantes…)",
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
