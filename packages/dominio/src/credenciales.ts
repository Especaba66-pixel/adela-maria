/** Reglas de formato para usuario, contraseña y PIN. Devuelven el mensaje de error o null. */

export const LONGITUD_MINIMA_CONTRASENA = 10;

export function validarUsuario(usuario: string): string | null {
  if (!/^[a-z0-9._-]{3,32}$/.test(usuario)) {
    return "El usuario debe tener de 3 a 32 caracteres: letras minúsculas sin tilde, números, punto o guion.";
  }
  return null;
}

export function validarContrasena(contrasena: string): string | null {
  if (contrasena.length < LONGITUD_MINIMA_CONTRASENA) {
    return `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`;
  }
  if (contrasena.length > 200) return "La contraseña es demasiado larga.";
  return null;
}

const PINES_DEBILES = new Set(["0000", "1111", "1234", "4321", "123456", "000000", "111111", "654321"]);

export function validarPin(pin: string): string | null {
  if (!/^\d{4,6}$/.test(pin)) return "El PIN debe tener de 4 a 6 números.";
  if (PINES_DEBILES.has(pin) || /^(\d)\1+$/.test(pin)) return "Ese PIN es demasiado fácil de adivinar.";
  return null;
}

/** Normaliza lo que se escribe en el campo usuario: sin espacios y en minúsculas. */
export function normalizarUsuario(usuario: string): string {
  return usuario.trim().toLowerCase();
}
