/**
 * Tarifas iniciales del centro, tal cual aparecen en las tarifas fotografiadas.
 *
 * PENDIENTE: faltan los 7 tratamientos faciales y los 11 de depilación con su nombre exacto,
 * duración y precio. Al recibir las fotos se copian aquí y se vuelve a ejecutar `pnpm db:seed`
 * (añade lo que falta y no duplica lo que ya existe).
 */

export interface TarifaTratamiento {
  nombre: string;
  /** Múltiplo de 5. Sin indicar = por decidir. */
  duracionMinutos?: number;
  /** Sin indicar = precio por decidir («Precio a consultar»). */
  precioCentimos?: number;
  descripcion?: string;
}

export interface TarifaCategoria {
  nombre: string;
  tratamientos: TarifaTratamiento[];
}

export interface TarifaBono {
  nombre: string;
  sesiones: number;
  precioCentimos: number;
  /** Categoría cuyos tratamientos cubre el bono. */
  categoria: string;
}

export const CATEGORIAS: TarifaCategoria[] = [
  { nombre: "Faciales", tratamientos: [] },
  { nombre: "Depilación", tratamientos: [] },
  // PENDIENTE: precio y duración del diseño de cejas.
  { nombre: "Cejas", tratamientos: [{ nombre: "Diseño de cejas" }] },
];

/** "Adaptados a las necesidades de tu piel": valen para cualquier facial. */
export const BONOS: TarifaBono[] = [
  { nombre: "Bono facial 3 sesiones", sesiones: 3, precioCentimos: 12_000, categoria: "Faciales" },
  { nombre: "Bono facial 6 sesiones", sesiones: 6, precioCentimos: 24_000, categoria: "Faciales" },
];
