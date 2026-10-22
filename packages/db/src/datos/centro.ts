/** Datos iniciales del centro. Se aplican solo si aún no hay nada guardado; después se cambian desde la app. */

/**
 * Citas a la vez (dato de Espe, 13 de octubre de 2026): hasta tres, salvo los tratamientos que van solos
 * (microblading, maquillaje y uñas). Se cambia en Configuración → Datos del centro.
 */
export const CABINAS = 3;

/**
 * Horario de Adela (dato de Espe, 22 de octubre de 2026). Lunes, descanso; domingo, cerrado. El sábado abre solo
 * con cita (hasta las 14:00): no se ofrece en la web, y Adela da esas citas desde la app («Dar cita igualmente»).
 */
const h = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));
export const HORARIO_INICIAL: { diaSemana: number; inicioMin: number; finMin: number }[] = (
  [
    [2, "09:15", "13:45"],
    [3, "09:15", "13:15"],
    [3, "15:30", "18:30"],
    [4, "11:00", "18:30"],
    [5, "11:00", "19:00"],
  ] as const
).map(([diaSemana, desde, hasta]) => ({ diaSemana, inicioMin: h(desde), finMin: h(hasta) }));

/**
 * Contacto que se publica en la landing.
 * Dirección: dato de Espe, 12 de octubre de 2026.
 * Teléfono y WhatsApp del centro: dato de Espe, 15 de octubre de 2026 (9 cifras).
 */
export const CONTACTO: { whatsapp: string | null; direccion: string | null; horario: string[]; instagram: string | null; reservas: string | null } = {
  whatsapp: "624745734",
  direccion: "C/ Francisco Pizarro 13, 1.ª planta, 06210 Torremejía (Badajoz)",
  horario: [
    "Lunes: descanso",
    "Martes: de 9:15 a 13:45",
    "Miércoles: de 9:15 a 13:15 y de 15:30 a 18:30",
    "Jueves: de 11:00 a 18:30",
    "Viernes: de 11:00 a 19:00",
    "Sábado: con cita previa, hasta las 14:00",
  ],
  /** Usuario de Instagram del centro (dato de Espe, 12 de octubre de 2026). */
  instagram: "adela_maria_bellezaholistica",
  /**
   * Servicio de reservas por internet (Cloudflare), publicado el 13 de octubre de 2026. Si fuera null, la web
   * explicaría cómo pedir cita por WhatsApp.
   */
  reservas: "https://adela-reservas.especaba66.workers.dev",
};
