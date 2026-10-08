/** Reglas de las peticiones de cita que hacen las clientas desde la web, sin clave. */

export const FRANJAS = ["manana", "tarde", "indiferente"] as const;
export type Franja = (typeof FRANJAS)[number];
export const NOMBRE_FRANJA: Record<Franja, string> = { manana: "Por la mañana", tarde: "Por la tarde", indiferente: "Me da igual" };

/** Días hacia delante que se puede pedir cita. */
export const DIAS_MAXIMOS_RESERVA = 60;
/** Peticiones sin contestar que puede tener a la vez un mismo teléfono (frena reservas falsas). */
export const MAX_PENDIENTES_POR_TELEFONO = 3;

export const TEXTO_PRIVACIDAD =
  "Adela María · Belleza holística usará tu nombre y teléfono solo para gestionar esta cita y contactarte por " +
  "teléfono o WhatsApp sobre ella. Puedes pedir que borremos tus datos cuando quieras.";

/**
 * Teléfono español a formato internacional (+34XXXXXXXXX). Acepta espacios, guiones, puntos y prefijo 34/0034/+34.
 * Devuelve null si no es un móvil o fijo español válido.
 */
export function normalizarTelefono(texto: string): string | null {
  let cifras = texto.replace(/[\s\-.()]/g, "");
  if (cifras.startsWith("+")) cifras = cifras.slice(1);
  else if (cifras.startsWith("00")) cifras = cifras.slice(2);
  if (!/^\d+$/.test(cifras)) return null;
  if (cifras.length === 11 && cifras.startsWith("34")) cifras = cifras.slice(2);
  if (!/^[6789]\d{8}$/.test(cifras)) return null;
  return `+34${cifras}`;
}

/** "+34600111222" → "600 11 12 22" para mostrar. */
export function formatearTelefono(normalizado: string): string {
  const n = normalizado.replace(/^\+34/, "");
  return `${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
}

/** Fecha de hoy (AAAA-MM-DD) en Madrid. */
export function hoyEnMadrid(ahora: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(ahora);
}

function sumarDias(fechaIso: string, dias: number): string {
  const d = new Date(`${fechaIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function rangoFechasReserva(ahora: Date): { desde: string; hasta: string } {
  const desde = hoyEnMadrid(ahora);
  return { desde, hasta: sumarDias(desde, DIAS_MAXIMOS_RESERVA) };
}

export interface DatosSolicitud {
  tratamientoId: string;
  fechaPreferida: string;
  franja: string;
  nombre: string;
  telefono: string;
  nota: string;
  aceptaPrivacidad: boolean;
}

export type SolicitudValidada = {
  tratamientoId: string;
  fechaPreferida: string;
  franja: Franja;
  nombre: string;
  telefono: string;
  nota: string | null;
};

/** Comprueba los datos del formulario. Devuelve los datos limpios o el primer error, en palabras de la clienta. */
export function validarSolicitud(d: DatosSolicitud, ahora: Date): { ok: true; datos: SolicitudValidada } | { ok: false; error: string } {
  if (!d.tratamientoId) return { ok: false, error: "Elige el tratamiento." };
  const nombre = d.nombre.trim().replace(/\s+/g, " ");
  if (nombre.length < 2 || nombre.length > 80) return { ok: false, error: "Escribe tu nombre." };
  const telefono = normalizarTelefono(d.telefono);
  if (!telefono) return { ok: false, error: "Revisa el teléfono: debe ser un número español de 9 cifras." };
  const { desde, hasta } = rangoFechasReserva(ahora);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fechaPreferida) || d.fechaPreferida < desde) {
    return { ok: false, error: "Elige un día a partir de hoy." };
  }
  if (d.fechaPreferida > hasta) return { ok: false, error: `Solo se puede pedir cita para los próximos ${DIAS_MAXIMOS_RESERVA} días.` };
  if (!(FRANJAS as readonly string[]).includes(d.franja)) return { ok: false, error: "Elige mañana, tarde o me da igual." };
  const nota = d.nota.trim();
  if (nota.length > 500) return { ok: false, error: "El comentario es demasiado largo (máximo 500 caracteres)." };
  if (!d.aceptaPrivacidad) return { ok: false, error: "Para pedir cita tienes que aceptar el uso de tus datos." };
  return {
    ok: true,
    datos: { tratamientoId: d.tratamientoId, fechaPreferida: d.fechaPreferida, franja: d.franja as Franja, nombre, telefono, nota: nota || null },
  };
}

/** Enlace de WhatsApp con el mensaje ya escrito (la persona del centro pulsa enviar). */
export function enlaceWhatsapp(telefono: string, mensaje: string): string {
  return `https://wa.me/${telefono.replace(/^\+/, "")}?text=${encodeURIComponent(mensaje)}`;
}
