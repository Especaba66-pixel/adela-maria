/**
 * Reglas de cobro: líneas, descuentos, IVA, pagos y cambio. Todo en céntimos enteros.
 * Los precios de las tarifas llevan el IVA incluido (venta a consumidoras).
 */

export const METODOS_PAGO = ["efectivo", "tarjeta", "bizum", "tarjeta_regalo"] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];
/** Las formas de pago de la caja y el datáfono (la tarjeta regalo va aparte: necesita su código). */
export const METODOS_CAJA = ["efectivo", "tarjeta", "bizum"] as const satisfies readonly MetodoPago[];
export const NOMBRE_METODO: Record<MetodoPago, string> = { efectivo: "Efectivo", tarjeta: "Tarjeta", bizum: "Bizum", tarjeta_regalo: "Tarjeta regalo" };

export interface LineaEntrada {
  descripcion: string;
  cantidad: number;
  /** Precio por unidad, IVA incluido. */
  precioUnitario: number;
  /** Descuento en centésimas de punto (1000 = 10 %). */
  descuentoCentesimas: number;
  /** Tipo de IVA en centésimas de punto (2100 = 21 %). */
  ivaCentesimas: number;
}

export interface LineaCalculada extends LineaEntrada {
  /** Total de la línea, IVA incluido, tras el descuento. */
  total: number;
}

export interface DesgloseIva {
  ivaCentesimas: number;
  base: number;
  cuota: number;
  total: number;
}

export function validarLinea(l: LineaEntrada): string | null {
  if (!l.descripcion.trim()) return "Falta la descripción.";
  if (!Number.isInteger(l.cantidad) || l.cantidad < 1 || l.cantidad > 99) return "La cantidad va de 1 a 99.";
  if (!Number.isInteger(l.precioUnitario) || l.precioUnitario < 0) return "Precio no válido.";
  if (!Number.isInteger(l.descuentoCentesimas) || l.descuentoCentesimas < 0 || l.descuentoCentesimas > 10_000) return "El descuento va de 0 a 100 %.";
  if (!Number.isInteger(l.ivaCentesimas) || l.ivaCentesimas < 0 || l.ivaCentesimas > 10_000) return "Tipo de IVA no válido.";
  return null;
}

export function calcularLinea(l: LineaEntrada): LineaCalculada {
  const bruto = l.precioUnitario * l.cantidad;
  return { ...l, total: bruto - Math.round((bruto * l.descuentoCentesimas) / 10_000) };
}

/**
 * Desglose de IVA por tipo: se suman los totales de cada tipo y se separa la base una sola vez,
 * para que base + cuota cuadre siempre con el total cobrado.
 */
export function desglosarIva(lineas: LineaCalculada[]): DesgloseIva[] {
  const porTipo = new Map<number, number>();
  for (const l of lineas) porTipo.set(l.ivaCentesimas, (porTipo.get(l.ivaCentesimas) ?? 0) + l.total);
  return [...porTipo.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([ivaCentesimas, total]) => {
      const base = Math.round((total * 10_000) / (10_000 + ivaCentesimas));
      return { ivaCentesimas, base, cuota: total - base, total };
    });
}

export const totalDe = (lineas: { total: number }[]) => lineas.reduce((s, l) => s + l.total, 0);

/** Lo que queda por pagar tras unos pagos. */
export function pendiente(total: number, pagos: { importe: number }[]): number {
  return total - pagos.reduce((s, p) => s + p.importe, 0);
}

/**
 * Comprueba los pagos de un cobro. En efectivo se puede entregar de más (se devuelve el cambio);
 * con tarjeta o Bizum no se puede pagar más de lo que falta.
 */
export function validarPagos(total: number, pagos: { metodo: MetodoPago; importe: number; entregado?: number }[]): string | null {
  let falta = total;
  for (const p of pagos) {
    if (!Number.isInteger(p.importe) || p.importe <= 0) return "Cada pago tiene que ser mayor que cero.";
    if (p.importe > falta) return "Los pagos suman más que el total.";
    if (p.metodo === "efectivo" && p.entregado !== undefined && p.entregado < p.importe) return "El efectivo entregado no llega.";
    falta -= p.importe;
  }
  return null;
}

/** Cambio a devolver en efectivo. */
export function cambio(importe: number, entregado: number): number {
  return Math.max(0, entregado - importe);
}

/** Porcentaje en texto ("10 %", "21 %", "10,5 %") desde centésimas. */
export function textoPorcentaje(centesimas: number): string {
  return `${(centesimas / 100).toLocaleString("es-ES", { maximumFractionDigits: 2 })} %`;
}

// ── Caja ─────────────────────────────────────────────────────────────────────

export const TIPOS_MOVIMIENTO_CAJA = ["fondo", "venta", "devolucion", "entrada", "salida"] as const;
export type TipoMovimientoCaja = (typeof TIPOS_MOVIMIENTO_CAJA)[number];

/** Efectivo que debería haber en el cajón: suma de movimientos (las salidas y devoluciones van en negativo). */
export function efectivoEsperado(movimientos: { importe: number }[]): number {
  return movimientos.reduce((s, m) => s + m.importe, 0);
}

/** Cuenta de monedas y billetes → total en céntimos. */
export const VALORES_EFECTIVO = [50_000, 20_000, 10_000, 5_000, 2_000, 1_000, 500, 200, 100, 50, 20, 10, 5, 2, 1] as const;
export function sumarRecuento(recuento: Partial<Record<number, number>>): number {
  return VALORES_EFECTIVO.reduce((s, v) => s + v * (recuento[v] ?? 0), 0);
}
