/**
 * Reglas de la agenda. Las horas se manejan como "minutos desde medianoche" de un día del calendario de Madrid,
 * y se convierten a instantes reales (Date) teniendo en cuenta el cambio de hora.
 */

export const ZONA = "Europe/Madrid";
/** La agenda trabaja en tramos de 5 minutos. */
export const MINUTOS_TRAMO = 5;
/** Cada cuántos minutos se ofrecen horas en la web de clientas. */
export const PASO_WEB = 15;
/** Antelación mínima para pedir cita desde la web. */
export const ANTELACION_MINUTOS_WEB = 120;

export interface Tramo {
  /** Minutos desde medianoche. */
  inicio: number;
  fin: number;
}
export interface Intervalo {
  inicio: Date;
  fin: Date;
}

// ── Fechas y horas en Madrid ─────────────────────────────────────────────────

const formatoPartes = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Día (AAAA-MM-DD) y minutos desde medianoche de un instante, en Madrid. */
export function partesMadrid(d: Date): { fecha: string; minutos: number } {
  const p = Object.fromEntries(formatoPartes.formatToParts(d).map((x) => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

/** Diferencia en minutos entre la hora de Madrid y UTC en ese instante (60 en invierno, 120 en verano). */
function desfase(d: Date): number {
  const { fecha, minutos } = partesMadrid(d);
  const comoUtc = Date.parse(`${fecha}T00:00:00Z`) + minutos * 60_000;
  return Math.round((comoUtc - Math.floor(d.getTime() / 60_000) * 60_000) / 60_000);
}

/** El instante real de un día y hora de Madrid. */
export function instanteMadrid(fecha: string, minutos: number): Date {
  const comoUtc = Date.parse(`${fecha}T00:00:00Z`) + minutos * 60_000;
  // Se prueba con el desfase de ese momento y se corrige una vez (cambio de hora).
  let t = comoUtc - desfase(new Date(comoUtc)) * 60_000;
  t = comoUtc - desfase(new Date(t)) * 60_000;
  return new Date(t);
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Día de la semana: 1 = lunes … 7 = domingo. */
export function diaSemana(fecha: string): number {
  const d = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function lunesDeLaSemana(fecha: string): string {
  return sumarDias(fecha, 1 - diaSemana(fecha));
}

/** Los días que se ven en el calendario de un mes: semanas completas de lunes a domingo. */
export function diasCalendarioMes(fecha: string): string[] {
  const primero = `${fecha.slice(0, 7)}-01`;
  const siguiente = sumarDias(primero, 32).slice(0, 7);
  const ultimo = sumarDias(`${siguiente}-01`, -1);
  const dias: string[] = [];
  for (let d = lunesDeLaSemana(primero); d <= ultimo || diaSemana(d) !== 1; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

export function esFecha(texto: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(Date.parse(`${texto}T12:00:00Z`)) && sumarDias(texto, 0) === texto;
}

/** "HH:MM" ↔ minutos. */
export function horaATexto(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}
export function textoAHora(texto: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(texto.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// ── Huecos libres ────────────────────────────────────────────────────────────

export function seSolapan(a: Intervalo, b: Intervalo): boolean {
  return a.inicio.getTime() < b.fin.getTime() && b.inicio.getTime() < a.fin.getTime();
}

/**
 * Horas de comienzo (minutos) en que cabe un servicio de `duracion` minutos dentro del horario de ese día,
 * sin pisar nada ocupado (citas o bloqueos) y no antes de `desde`.
 */
export function huecosLibres(opciones: {
  fecha: string;
  horario: Tramo[];
  ocupados: Intervalo[];
  duracion: number;
  paso: number;
  desde?: Date;
}): number[] {
  const { fecha, horario, ocupados, duracion, paso, desde } = opciones;
  if (duracion <= 0) return [];
  const libres: number[] = [];
  for (const tramo of [...horario].sort((a, b) => a.inicio - b.inicio)) {
    for (let t = Math.ceil(tramo.inicio / paso) * paso; t + duracion <= tramo.fin; t += paso) {
      const candidato = { inicio: instanteMadrid(fecha, t), fin: instanteMadrid(fecha, t + duracion) };
      if (desde && candidato.inicio.getTime() < desde.getTime()) continue;
      if (ocupados.some((o) => seSolapan(candidato, o))) continue;
      if (!libres.includes(t)) libres.push(t);
    }
  }
  return libres;
}

/** ¿Cabe la cita entera dentro de algún tramo del horario? */
export function dentroDeHorario(horario: Tramo[], inicio: number, duracion: number): boolean {
  return horario.some((t) => inicio >= t.inicio && inicio + duracion <= t.fin);
}

/** Valida los tramos de un día: cada uno empieza antes de acabar, en tramos de 5 minutos y sin pisarse. */
export function validarHorarioDia(tramos: Tramo[]): string | null {
  const orden = [...tramos].sort((a, b) => a.inicio - b.inicio);
  for (const [i, t] of orden.entries()) {
    if (t.inicio < 0 || t.fin > 24 * 60 || t.inicio >= t.fin) return "Cada tramo tiene que empezar antes de acabar.";
    if (t.inicio % MINUTOS_TRAMO || t.fin % MINUTOS_TRAMO) return "Las horas tienen que ir de 5 en 5 minutos.";
    if (i > 0 && t.inicio < orden[i - 1]!.fin) return "Los tramos de un mismo día no pueden pisarse.";
  }
  return null;
}

// ── Citas ────────────────────────────────────────────────────────────────────

export const ESTADOS_CITA = ["pendiente", "confirmada", "realizada", "no_presentada", "cancelada"] as const;
export type EstadoCita = (typeof ESTADOS_CITA)[number];

export const NOMBRE_ESTADO: Record<EstadoCita, string> = {
  pendiente: "Por confirmar",
  confirmada: "Confirmada",
  realizada: "Realizada",
  no_presentada: "No vino",
  cancelada: "Cancelada",
};

const TRANSICIONES: Record<EstadoCita, readonly EstadoCita[]> = {
  pendiente: ["confirmada", "cancelada"],
  confirmada: ["realizada", "no_presentada", "cancelada"],
  // Para corregir un error al marcarla.
  realizada: ["confirmada"],
  no_presentada: ["confirmada"],
  cancelada: [],
};

export function puedeCambiarEstado(de: EstadoCita, a: EstadoCita): boolean {
  return TRANSICIONES[de].includes(a);
}

/** Duración total de una cita con varios servicios. null si alguno no tiene duración decidida. */
export function duracionTotal(servicios: { duracionMinutos: number | null }[]): number | null {
  if (servicios.length === 0) return null;
  let total = 0;
  for (const s of servicios) {
    if (s.duracionMinutos === null) return null;
    total += s.duracionMinutos;
  }
  return total;
}

/** Fechas de una serie que se repite cada `cadaSemanas` semanas, `veces` veces en total (incluida la primera). */
export function fechasSerie(fecha: string, cadaSemanas: number, veces: number): string[] {
  return Array.from({ length: veces }, (_, i) => sumarDias(fecha, i * cadaSemanas * 7));
}

/** Partes del horario que quedan libres tras quitar lo ocupado (todo en minutos del día). */
export function tramosLibres(horario: Tramo[], ocupado: Tramo[]): Tramo[] {
  const libres: Tramo[] = [];
  const orden = [...ocupado].sort((a, b) => a.inicio - b.inicio);
  for (const t of [...horario].sort((a, b) => a.inicio - b.inicio)) {
    let cursor = t.inicio;
    for (const o of orden) {
      if (o.fin <= cursor || o.inicio >= t.fin) continue;
      if (o.inicio > cursor) libres.push({ inicio: cursor, fin: o.inicio });
      cursor = Math.max(cursor, o.fin);
    }
    if (cursor < t.fin) libres.push({ inicio: cursor, fin: t.fin });
  }
  return libres;
}

/** Un intervalo real convertido a minutos del día `fecha` (recortado a ese día). */
export function aMinutosDelDia(fecha: string, i: Intervalo): Tramo {
  const inicioDia = instanteMadrid(fecha, 0).getTime();
  const finDia = instanteMadrid(sumarDias(fecha, 1), 0).getTime();
  const ini = Math.max(i.inicio.getTime(), inicioDia);
  const fin = Math.min(i.fin.getTime(), finDia);
  return { inicio: partesMadrid(new Date(ini)).minutos, fin: fin >= finDia ? 24 * 60 : partesMadrid(new Date(fin)).minutos };
}
