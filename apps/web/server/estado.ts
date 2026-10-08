import "server-only";
import { copiasSeguridad, tratamientos } from "@adela/db";
import type { Prioridad } from "@adela/ui";
import { desc, eq, isNull } from "drizzle-orm";
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
    avisos.push({ prioridad: "urgente", texto: "No hay ninguna copia de seguridad registrada.", enlace: "/mas/configuracion/copias" });
  } else if (!ultima.correcta) {
    avisos.push({ prioridad: "urgente", texto: "La última copia de seguridad falló.", enlace: "/mas/configuracion/copias" });
  } else if (Date.now() - ultima.cuando.getTime() > HORAS_MAX_SIN_COPIA * 3_600_000) {
    avisos.push({ prioridad: "urgente", texto: "Hace más de un día que no se hace una copia de seguridad.", enlace: "/mas/configuracion/copias" });
  }

  const [prueba] = await db()
    .select()
    .from(copiasSeguridad)
    .where(eq(copiasSeguridad.tipo, "restauracion"))
    .orderBy(desc(copiasSeguridad.cuando))
    .limit(1);
  if (prueba && !prueba.correcta) {
    avisos.push({ prioridad: "urgente", texto: "La última prueba de restauración de copias falló.", enlace: "/mas/configuracion/copias" });
  }

  const [hayTratamiento] = await db()
    .select({ id: tratamientos.id })
    .from(tratamientos)
    .where(isNull(tratamientos.anuladoEn))
    .limit(1);
  if (!hayTratamiento) {
    avisos.push({ prioridad: "pendiente", texto: "Faltan por cargar los tratamientos de las tarifas.", enlace: "/mas/tratamientos" });
  }
  return avisos;
}
