/** Reglas de sesión y de bloqueo por intentos fallidos. Todo en milisegundos y con `ahora` explícito. */

export const MAX_INTENTOS_FALLIDOS = 5;
export const MINUTOS_BLOQUEO = 5;

export function sesionCaducada(ultimaActividad: Date, ahora: Date, minutosInactividad: number): boolean {
  return ahora.getTime() - ultimaActividad.getTime() > minutosInactividad * 60_000;
}

export function estaBloqueado(bloqueadoHasta: Date | null, ahora: Date): boolean {
  return bloqueadoHasta !== null && bloqueadoHasta.getTime() > ahora.getTime();
}

/** Tras un intento fallido: nuevo contador y, si llega al máximo, hasta cuándo queda bloqueado. */
export function trasIntentoFallido(
  intentosPrevios: number,
  ahora: Date,
): { intentos: number; bloqueadoHasta: Date | null } {
  const intentos = intentosPrevios + 1;
  if (intentos >= MAX_INTENTOS_FALLIDOS) {
    return { intentos: 0, bloqueadoHasta: new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60_000) };
  }
  return { intentos, bloqueadoHasta: null };
}
