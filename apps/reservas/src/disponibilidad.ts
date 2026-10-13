/**
 * Horas libres para reservar por internet. Mismas reglas que la agenda del TPV: el horario, los bloqueos, tantas
 * citas a la vez como cabinas y los tratamientos que van solos (microblading) sin nada a la vez.
 */
import {
  ANTELACION_MINUTOS_WEB,
  PASO_WEB,
  cabeCita,
  diaSemana,
  huecosLibres,
  instanteMadrid,
  type CitaOcupa,
  type Tramo,
} from "@adela/dominio/agenda";
import { rangoFechasReserva } from "@adela/dominio/reservas";

export interface Servicio {
  id: string;
  nombre: string;
  categoria: string;
  duracion: number;
  exclusivo: boolean;
  precio: number | null;
}
/** Algo que ya ocupa el centro: una cita (de la agenda o reservada en la web) o un bloqueo. */
export interface Ocupa {
  inicio: number;
  fin: number;
  exclusiva: boolean;
  bloqueo: boolean;
}
export interface Estado {
  horario: { diaSemana: number; inicio: number; fin: number }[];
  ocupado: Ocupa[];
  cabinas: number;
}

const PROFESIONAL = "centro";

export function horarioDelDia(estado: Estado, fecha: string): Tramo[] {
  const d = diaSemana(fecha);
  return estado.horario.filter((h) => h.diaSemana === d).map((h) => ({ inicio: h.inicio, fin: h.fin }));
}

/** Horas de comienzo (minutos desde medianoche) en que cabe el servicio ese día. */
export function horasLibres(estado: Estado, servicio: Servicio, fecha: string, ahora: Date): number[] {
  const { desde, hasta } = rangoFechasReserva(ahora);
  if (fecha < desde || fecha > hasta) return [];
  const bloqueos = estado.ocupado.filter((o) => o.bloqueo).map(aIntervalo);
  const citas: CitaOcupa[] = estado.ocupado.filter((o) => !o.bloqueo).map((o) => ({ ...aIntervalo(o), exclusiva: o.exclusiva, profesionalId: PROFESIONAL }));
  return huecosLibres({
    fecha,
    horario: horarioDelDia(estado, fecha),
    ocupados: bloqueos,
    duracion: servicio.duracion,
    paso: PASO_WEB,
    desde: new Date(ahora.getTime() + ANTELACION_MINUTOS_WEB * 60_000),
    admite: (i) => cabeCita({ ...i, exclusiva: servicio.exclusivo, profesionalId: PROFESIONAL }, citas, estado.cabinas),
  });
}

/** ¿Sigue libre esa hora? (se vuelve a comprobar justo antes de guardar). */
export function estaLibre(estado: Estado, servicio: Servicio, fecha: string, minutos: number, ahora: Date): boolean {
  return horasLibres(estado, servicio, fecha, ahora).includes(minutos);
}

export function intervalo(fecha: string, minutos: number, duracion: number) {
  return { inicio: instanteMadrid(fecha, minutos).getTime(), fin: instanteMadrid(fecha, minutos + duracion).getTime() };
}

const aIntervalo = (o: Ocupa) => ({ inicio: new Date(o.inicio), fin: new Date(o.fin) });
