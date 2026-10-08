export const ZONA = "Europe/Madrid";

const formatoFechaHora = new Intl.DateTimeFormat("es-ES", { timeZone: ZONA, dateStyle: "short", timeStyle: "medium" });
const formatoFechaLarga = new Intl.DateTimeFormat("es-ES", { timeZone: ZONA, weekday: "long", day: "numeric", month: "long" });

export const fechaHora = (d: Date) => formatoFechaHora.format(d);
export const fechaLarga = (d: Date) => formatoFechaLarga.format(d);

export function saludo(d: Date): string {
  const hora = Number(new Intl.DateTimeFormat("es-ES", { timeZone: ZONA, hour: "numeric", hourCycle: "h23" }).format(d));
  if (hora < 6 || hora >= 21) return "Buenas noches";
  if (hora < 14) return "Buenos días";
  return "Buenas tardes";
}

const formatoDia = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

/** "2026-10-10" → "sábado, 10 de octubre". La fecha es un día del calendario, sin hora. */
export const diaLargo = (fechaIso: string) => formatoDia.format(new Date(`${fechaIso}T12:00:00Z`));
