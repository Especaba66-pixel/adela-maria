import "server-only";
import { centro, copiasSeguridad, horarios, profesionales, tiposBono, tratamientos } from "@adela/db";
import type { Prioridad } from "@adela/ui";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "./db";

export interface AvisoSistema {
  prioridad: Prioridad;
  texto: string;
  enlace?: string;
}

const HORAS_MAX_SIN_COPIA = 26;

/** Avisos del propio sistema para la administración: copias y datos que faltan. */
export async function avisosSistema(): Promise<AvisoSistema[]> {
  const avisos: AvisoSistema[] = [];
  const [ultima] = await db()
    .select()
    .from(copiasSeguridad)
    .where(eq(copiasSeguridad.tipo, "copia"))
    .orderBy(desc(copiasSeguridad.cuando))
    .limit(1);
  if (!ultima) {
    avisos.push({ prioridad: "urgente", texto: "No hay ninguna copia de seguridad registrada.", enlace: "/gestion/mas/configuracion/copias" });
  } else if (!ultima.correcta) {
    avisos.push({ prioridad: "urgente", texto: "La última copia de seguridad falló.", enlace: "/gestion/mas/configuracion/copias" });
  } else if (Date.now() - ultima.cuando.getTime() > HORAS_MAX_SIN_COPIA * 3_600_000) {
    avisos.push({ prioridad: "urgente", texto: "Hace más de un día que no se hace una copia de seguridad.", enlace: "/gestion/mas/configuracion/copias" });
  }

  const [prueba] = await db()
    .select()
    .from(copiasSeguridad)
    .where(eq(copiasSeguridad.tipo, "restauracion"))
    .orderBy(desc(copiasSeguridad.cuando))
    .limit(1);
  if (prueba && !prueba.correcta) {
    avisos.push({ prioridad: "urgente", texto: "La última prueba de restauración de copias falló.", enlace: "/gestion/mas/configuracion/copias" });
  }

  const [hayTratamiento] = await db()
    .select({ id: tratamientos.id })
    .from(tratamientos)
    .where(isNull(tratamientos.anuladoEn))
    .limit(1);
  if (!hayTratamiento) {
    avisos.push({ prioridad: "pendiente", texto: "Faltan por cargar los tratamientos de las tarifas.", enlace: "/gestion/mas/tratamientos" });
  }

  const [conHorario] = await db()
    .select({ id: horarios.id })
    .from(horarios)
    .innerJoin(profesionales, eq(profesionales.id, horarios.profesionalId))
    .where(eq(profesionales.activo, true))
    .limit(1);
  if (!conHorario) {
    avisos.push({
      prioridad: "importante",
      texto: "Falta el horario: sin él, las clientas no ven horas libres en la web.",
      enlace: "/gestion/mas/configuracion/horario",
    });
  }

  const [c] = await db().select().from(centro).limit(1);
  if (!c?.nif || !c.nombreFiscal || !c.direccionFiscal) {
    avisos.push({ prioridad: "importante", texto: "Faltan los datos fiscales del centro: sin ellos no se puede cobrar.", enlace: "/gestion/mas/configuracion/centro" });
  }
  const [sinIva] = await db()
    .select({ id: tratamientos.id })
    .from(tratamientos)
    .where(and(isNull(tratamientos.anuladoEn), isNull(tratamientos.ivaCentesimas)))
    .limit(1);
  const [bonoSinIva] = await db()
    .select({ id: tiposBono.id })
    .from(tiposBono)
    .where(and(isNull(tiposBono.anuladoEn), isNull(tiposBono.ivaCentesimas)))
    .limit(1);
  if (sinIva || bonoSinIva) {
    avisos.push({ prioridad: "importante", texto: "Hay tratamientos sin IVA: no se pueden cobrar hasta ponérselo.", enlace: "/gestion/mas/tratamientos" });
  }

  const sinPrecio = await db()
    .select({ nombre: tratamientos.nombre })
    .from(tratamientos)
    .where(and(isNull(tratamientos.anuladoEn), or(isNull(tratamientos.precioCentimos), isNull(tratamientos.duracionMinutos))));
  if (sinPrecio.length > 0) {
    avisos.push({
      prioridad: "pendiente",
      texto: `Falta el precio o la duración de: ${sinPrecio.map((t) => t.nombre).join(", ")}.`,
      enlace: "/gestion/mas/tratamientos",
    });
  }
  return avisos;
}
