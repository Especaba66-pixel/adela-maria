/** Datos iniciales del centro. Se aplican solo si aún no hay nada guardado; después se cambian desde la app. */

/**
 * Citas a la vez (dato de Espe, 13 de octubre de 2026): hasta tres, salvo los tratamientos que van solos
 * (microblading, maquillaje y uñas). Se cambia en Configuración → Datos del centro.
 */
export const CABINAS = 3;

/**
 * Horario provisional de Adela (dato de Espe, 12 de octubre de 2026): de lunes (1) a viernes (5), de 9:00 a 14:00.
 * Los sábados no se abre.
 */
export const HORARIO_INICIAL: { diaSemana: number; inicioMin: number; finMin: number }[] = [1, 2, 3, 4, 5].map((diaSemana) => ({
  diaSemana,
  inicioMin: 9 * 60,
  finMin: 14 * 60,
}));

/**
 * Contacto que se publica en la landing.
 * Dirección: dato de Espe, 12 de octubre de 2026.
 * PENDIENTE: el número de WhatsApp del centro (no el móvil personal de Adela).
 * Formato del WhatsApp: 9 cifras, por ejemplo "600112233".
 */
export const CONTACTO: { whatsapp: string | null; direccion: string | null; horario: string; instagram: string | null; reservas: string | null } = {
  whatsapp: null,
  direccion: "C/ Francisco Pizarro 13, 1.ª planta, 06210 Torremejía (Badajoz)",
  horario: "De lunes a viernes, de 9:00 a 14:00",
  /** Usuario de Instagram del centro (dato de Espe, 12 de octubre de 2026). */
  instagram: "adela_maria_bellezaholistica",
  /**
   * Servicio de reservas por internet (Cloudflare), publicado el 13 de octubre de 2026. Si fuera null, la web
   * explicaría cómo pedir cita por WhatsApp.
   */
  reservas: "https://adela-reservas.especaba66.workers.dev",
};
