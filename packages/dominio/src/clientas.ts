/** Reglas de la ficha de clienta. */
import { normalizarTelefono } from "./reservas";

export interface DatosClienta {
  nombre: string;
  telefono: string;
  email: string;
  fechaNacimiento: string;
  notas: string;
}

export type ClientaValidada = {
  nombre: string;
  telefono: string | null;
  email: string | null;
  fechaNacimiento: string | null;
  notas: string | null;
};

export function validarClienta(d: DatosClienta, hoy: string): { ok: true; datos: ClientaValidada } | { ok: false; error: string } {
  const nombre = d.nombre.trim().replace(/\s+/g, " ");
  if (nombre.length < 2 || nombre.length > 80) return { ok: false, error: "Escribe el nombre." };
  let telefono: string | null = null;
  if (d.telefono.trim()) {
    telefono = normalizarTelefono(d.telefono);
    if (!telefono) return { ok: false, error: "Revisa el teléfono: debe ser un número español de 9 cifras." };
  }
  const email = d.email.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Revisa el correo electrónico." };
  const fechaNacimiento = d.fechaNacimiento.trim() || null;
  if (fechaNacimiento && (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento) || fechaNacimiento > hoy || fechaNacimiento < "1900-01-01")) {
    return { ok: false, error: "Revisa la fecha de nacimiento." };
  }
  const notas = d.notas.trim() || null;
  if (notas && notas.length > 2000) return { ok: false, error: "Las notas son demasiado largas." };
  return { ok: true, datos: { nombre, telefono, email, fechaNacimiento, notas } };
}

/** Texto para buscar por teléfono: si parece un número, lo normaliza a +34…; si no, null. */
export function telefonoDeBusqueda(texto: string): string | null {
  const cifras = texto.replace(/\D/g, "");
  if (cifras.length < 3) return null;
  return cifras.length >= 9 ? normalizarTelefono(texto) : cifras;
}
