/** Datos iniciales del centro. Se aplican solo si aún no hay nada guardado; después se cambian desde la app. */

/** Cabinas (dato de Espe, 9 de octubre de 2026): hasta dos citas a la vez. */
export const CABINAS = 2;

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
export const CONTACTO: { whatsapp: string | null; direccion: string | null; horario: string; instagram: string | null } = {
  whatsapp: null,
  direccion: "C/ Francisco Pizarro 13, 1.ª planta, 06210 Torremejía (Badajoz)",
  horario: "De lunes a viernes, de 9:00 a 14:00",
  /** Usuario de Instagram del centro (dato de Espe, 12 de octubre de 2026). */
  instagram: "adela_maria_bellezaholistica",
};
