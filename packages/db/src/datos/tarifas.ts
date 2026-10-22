/**
 * Tarifas del centro, copiadas de las hojas de tarifas (fotos de «Faciales» y «Depilación» enviadas el 8 de octubre
 * de 2026; pestañas y cejas, masajes, spa, corporal, maquillaje y microblading, el 22 de octubre de 2026). Para cambiarlas: editar aquí y ejecutar `pnpm db:seed`, que añade lo nuevo y no duplica lo que ya existe.
 */

export interface TarifaTratamiento {
  nombre: string;
  /** Múltiplo de 5. Sin indicar = por decidir. */
  duracionMinutos?: number;
  /** Sin indicar = precio por decidir («Precio a consultar»). */
  precioCentimos?: number;
  descripcion?: string;
  /** Va sola: no admite ninguna otra cita a la vez (microblading, maquillaje, uñas). */
  exclusivo?: boolean;
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
  /** Qué cubre, como se explica en la web. Sin indicar: cualquier facial. */
  descripcion?: string;
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
  {
    nombre: "Pestañas y cejas",
    tratamientos: [
      { nombre: "Lifting de pestañas", duracionMinutos: 45, precioCentimos: 2_900 },
      { nombre: "Laminado de cejas", duracionMinutos: 45, precioCentimos: 2_900 },
    ],
  },
  {
    nombre: "Masajes y spa",
    tratamientos: [
      { nombre: "Masaje cuello y cervicales (suelta tensión)", duracionMinutos: 20, precioCentimos: 1_800 },
      { nombre: "Masaje craneal y facial", duracionMinutos: 20, precioCentimos: 1_800 },
      { nombre: "Tratamiento spa para pies", duracionMinutos: 30, precioCentimos: 2_000 },
      { nombre: "Tratamiento spa para manos", duracionMinutos: 30, precioCentimos: 2_000 },
    ],
  },
  {
    nombre: "Corporal",
    tratamientos: [
      { nombre: "Peeling + hidratación corporal", duracionMinutos: 45, precioCentimos: 3_500 },
      { nombre: "Presoterapia (1 sesión)", duracionMinutos: 35, precioCentimos: 1_000 },
      { nombre: "Ritual piernas ligeras + glow facial express", duracionMinutos: 35, precioCentimos: 3_000 },
    ],
  },
  {
    // Van solos (dato de Espe, 13 de octubre de 2026): no admiten otra cita a la vez.
    // PENDIENTE: precio y duración de las uñas; hasta tenerlos, no se reservan por internet.
    nombre: "Microblading, maquillaje y uñas",
    tratamientos: [
      { nombre: "Microblading", duracionMinutos: 210, precioCentimos: 25_000, exclusivo: true },
      { nombre: "Maquillaje", duracionMinutos: 60, precioCentimos: 3_000, exclusivo: true },
      { nombre: "Uñas", exclusivo: true },
    ],
  },
];

/**
 * «Adaptados a las necesidades de tu piel»: valen para cualquier facial, también «Unos labios más gruesos».
 * No caducan (las dos cosas confirmadas por Espe el 12 de octubre de 2026).
 */
export const BONOS: TarifaBono[] = [
  { nombre: "Bono facial 3 sesiones", sesiones: 3, precioCentimos: 12_000, categoria: "Faciales" },
  { nombre: "Bono facial 6 sesiones", sesiones: 6, precioCentimos: 24_000, categoria: "Faciales" },
  {
    // Precio tal como viene en la hoja de Adela (22 de octubre de 2026): 40 € las 7 sesiones (la suelta, 10 €).
    nombre: "Bono presoterapia 7 sesiones",
    sesiones: 7,
    precioCentimos: 4_000,
    categoria: "Corporal",
    excepto: ["Peeling + hidratación corporal", "Ritual piernas ligeras + glow facial express"],
    descripcion: "Sesiones de presoterapia de 35 minutos",
  },
];
