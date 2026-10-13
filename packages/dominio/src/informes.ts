/**
 * Informes: periodos, comisiones y el cuadre del mes (ventas, cobros, facturas y caja deben coincidir).
 */
import { sumarDias } from "./agenda";

/** Un mes «AAAA-MM» → primer y último día. */
export function periodoDeMes(mes: string): { desde: string; hasta: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  const desde = `${mes}-01`;
  const siguiente = Number(m[2]) === 12 ? `${Number(m[1]) + 1}-01-01` : `${m[1]}-${String(Number(m[2]) + 1).padStart(2, "0")}-01`;
  return { desde, hasta: sumarDias(siguiente, -1) };
}

/** Mes anterior y siguiente («AAAA-MM»). */
export function mesVecino(mes: string, salto: -1 | 1): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  const total = a * 12 + (m - 1) + salto;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const nombreMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;

/** Comisión sobre una base (sin IVA), redondeada al céntimo. `centesimas`: 1000 = 10 %. */
export const comision = (base: number, centesimas: number) => Math.round((base * centesimas) / 10_000);

/** Base sin IVA de un importe con IVA incluido. */
export const baseSinIva = (total: number, ivaCentesimas: number) => Math.round((total * 10_000) / (10_000 + ivaCentesimas));

/** «10» o «12,5» → centésimas (1000, 1250); vacío → 0; mal escrito → null. */
export function leerPorcentaje(texto: string): number | null {
  const t = texto.trim().replace("%", "").replace(",", ".");
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) : null;
}


export interface Cuadre {
  /** Suma de las ventas (con las devoluciones restando). */
  ventas: number;
  /** Suma de las ventas que llevan factura (la venta de tarjetas regalo no lleva). */
  ventasConFactura: number;
  /** Suma de las facturas emitidas (rectificativas restando). */
  facturas: number;
  /** Lo cobrado (pagos, de cualquier método). */
  cobrado: number;
  /** Lo que se dejó a deber en ventas del periodo y aún no se ha pagado. */
  pendiente: number;
  /** Efectivo cobrado según los pagos y según los movimientos del cajón. */
  efectivoPagos: number;
  efectivoCaja: number;
}

export interface ComprobacionCuadre {
  nombre: string;
  ok: boolean;
  detalle: string;
}

/** Comprueba que todo coincide; si no, dice dónde está la diferencia. */
export function comprobarCuadre(c: Cuadre, euros: (n: number) => string): ComprobacionCuadre[] {
  const dif = (a: number, b: number) => (a === b ? "coinciden" : `diferencia de ${euros(a - b)}`);
  return [
    { nombre: "Ventas con factura = facturas emitidas", ok: c.ventasConFactura === c.facturas, detalle: `${euros(c.ventasConFactura)} y ${euros(c.facturas)}: ${dif(c.ventasConFactura, c.facturas)}` },
    { nombre: "Ventas = cobrado + pendiente", ok: c.ventas === c.cobrado + c.pendiente, detalle: `${euros(c.ventas)} y ${euros(c.cobrado + c.pendiente)}: ${dif(c.ventas, c.cobrado + c.pendiente)}` },
    { nombre: "Efectivo cobrado = efectivo en caja", ok: c.efectivoPagos === c.efectivoCaja, detalle: `${euros(c.efectivoPagos)} y ${euros(c.efectivoCaja)}: ${dif(c.efectivoPagos, c.efectivoCaja)}` },
  ];
}
