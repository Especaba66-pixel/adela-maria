/**
 * Tarifas del centro, copiadas de las hojas de tarifas (fotos de «Faciales» y «Depilación» enviadas el 8 de octubre
 * de 2026). Para cambiarlas: editar aquí y ejecutar `pnpm db:seed`, que añade lo nuevo y no duplica lo que ya existe.
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
  /** Tratamientos de esa categoría que el bono NO cubre. */
  excepto?: string[];
}

export const CATEGORIAS: TarifaCategoria[] = [
  {
    // «¿Qué necesita tu piel?»
    nombre: "Faciales",
    tratamientos: [
      { nombre: "Verse limpia y purificada (higiene facial)", duracionMinutos: 90, precioCentimos: 3_000 },
      { nombre: "Verse perfecta y sin marcas", duracionMinutos: 90, precioCentimos: 4_500 },
      { nombre: "Verse sin manchas", duracionMinutos: 90, precioCentimos: 4_500 },
      { nombre: "Con luminosidad y vida (D-Glow)", duracionMinutos: 90, precioCentimos: 4_500 },
      { nombre: "Sin arruguitas", duracionMinutos: 90, precioCentimos: 4_500 },
      { nombre: "Unos labios más gruesos", duracionMinutos: 30, precioCentimos: 1_800 },
      { nombre: "Tersa y reafirmada", duracionMinutos: 90, precioCentimos: 4_500 },
    ],
  },
  {
    // «¿Qué vello necesita eliminar?»
    nombre: "Depilación",
    tratamientos: [
      { nombre: "Labio, mentón o patilla", duracionMinutos: 5, precioCentimos: 300 },
      { nombre: "Diseño y depilación de cejas", duracionMinutos: 10, precioCentimos: 500 },
      { nombre: "Ceja y labio", duracionMinutos: 15, precioCentimos: 700 },
      { nombre: "Medias piernas", duracionMinutos: 10, precioCentimos: 700 },
      { nombre: "Piernas enteras", duracionMinutos: 20, precioCentimos: 1_300 },
      { nombre: "Ingles", duracionMinutos: 15, precioCentimos: 500 },
      { nombre: "Axilas", duracionMinutos: 10, precioCentimos: 500 },
      { nombre: "Brazos", duracionMinutos: 15, precioCentimos: 800 },
      { nombre: "Piernas hombre", duracionMinutos: 25, precioCentimos: 1_500 },
      { nombre: "Espalda caballero", duracionMinutos: 20, precioCentimos: 1_200 },
      { nombre: "Pecho caballero", duracionMinutos: 30, precioCentimos: 1_200 },
    ],
  },
  // PENDIENTE: precio y duración del diseño de cejas.
  { nombre: "Cejas", tratamientos: [{ nombre: "Diseño de cejas" }] },
];

/**
 * «Adaptados a las necesidades de tu piel», 1:30 h cada sesión: cubren los faciales de hora y media.
 * PENDIENTE de confirmar: se deja fuera «Unos labios más gruesos» (30 min, 18 €).
 */
export const BONOS: TarifaBono[] = [
  { nombre: "Bono facial 3 sesiones", sesiones: 3, precioCentimos: 12_000, categoria: "Faciales", excepto: ["Unos labios más gruesos"] },
  { nombre: "Bono facial 6 sesiones", sesiones: 6, precioCentimos: 24_000, categoria: "Faciales", excepto: ["Unos labios más gruesos"] },
];
