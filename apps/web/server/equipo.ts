import "server-only";
import { horarios, profesionales, profesionalesTratamientos, registrarActividad, usuarios } from "@adela/db";
import { validarHorarioDia, type Tramo } from "@adela/dominio";
import { and, eq, ne } from "drizzle-orm";
import { requerirSesion } from "./auth";
import { db } from "./db";

export type Resultado = { ok: true; mensaje: string } | { ok: false; error: string };

export async function guardarProfesional(datos: {
  id?: string;
  nombre: string;
  color: string;
  usuarioId: string;
  activo: boolean;
  tratamientoIds: string[];
}): Promise<Resultado> {
  const { usuario } = await requerirSesion("configuracion.gestionar");
  const nombre = datos.nombre.trim();
  if (nombre.length < 2) return { ok: false, error: "Escribe el nombre." };
  if (!/^#[0-9a-f]{6}$/i.test(datos.color)) return { ok: false, error: "Color no válido." };
  const usuarioId = datos.usuarioId || null;
  if (usuarioId) {
    const [u] = await db().select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.id, usuarioId));
    if (!u) return { ok: false, error: "Ese usuario no existe." };
    const [otro] = await db()
      .select({ nombre: profesionales.nombre })
      .from(profesionales)
      .where(and(eq(profesionales.usuarioId, usuarioId), datos.id ? ne(profesionales.id, datos.id) : undefined));
    if (otro) return { ok: false, error: `Ese usuario ya es la agenda de ${otro.nombre}.` };
  }
  const [mismoNombre] = await db()
    .select({ id: profesionales.id })
    .from(profesionales)
    .where(and(eq(profesionales.nombre, nombre), datos.id ? ne(profesionales.id, datos.id) : undefined));
  if (mismoNombre) return { ok: false, error: "Ya hay una profesional con ese nombre." };

  await db().transaction(async (tx) => {
    let id = datos.id;
    if (id) {
      const [antes] = await tx.select().from(profesionales).where(eq(profesionales.id, id));
      const [despues] = await tx.update(profesionales).set({ nombre, color: datos.color, usuarioId, activo: datos.activo }).where(eq(profesionales.id, id)).returning();
      await registrarActividad(tx, { usuarioId: usuario.id, accion: "profesional.editar", entidad: "profesionales", entidadId: id, antes, despues });
    } else {
      const [nueva] = await tx.insert(profesionales).values({ nombre, color: datos.color, usuarioId, activo: datos.activo }).returning();
      id = nueva!.id;
      await registrarActividad(tx, { usuarioId: usuario.id, accion: "profesional.crear", entidad: "profesionales", entidadId: id, despues: nueva });
    }
    await tx.delete(profesionalesTratamientos).where(eq(profesionalesTratamientos.profesionalId, id));
    if (datos.tratamientoIds.length) {
      await tx.insert(profesionalesTratamientos).values(datos.tratamientoIds.map((t) => ({ profesionalId: id!, tratamientoId: t })));
    }
  });
  return { ok: true, mensaje: "Guardado." };
}

/** Sustituye el horario semanal de una profesional. `dias[d]` = tramos del día d (1 = lunes). */
export async function guardarHorario(profesionalId: string, dias: Record<number, Tramo[]>): Promise<Resultado> {
  const { usuario } = await requerirSesion("configuracion.gestionar");
  for (let d = 1; d <= 7; d++) {
    const error = validarHorarioDia(dias[d] ?? []);
    if (error) return { ok: false, error: `${["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][d]}: ${error}` };
  }
  await db().transaction(async (tx) => {
    const antes = await tx.select().from(horarios).where(eq(horarios.profesionalId, profesionalId));
    await tx.delete(horarios).where(eq(horarios.profesionalId, profesionalId));
    const filas = Object.entries(dias).flatMap(([d, tramos]) => tramos.map((t) => ({ profesionalId, diaSemana: Number(d), inicioMin: t.inicio, finMin: t.fin })));
    if (filas.length) await tx.insert(horarios).values(filas);
    await registrarActividad(tx, {
      usuarioId: usuario.id,
      accion: "horario.editar",
      entidad: "profesionales",
      entidadId: profesionalId,
      antes: antes.map((h) => ({ dia: h.diaSemana, inicio: h.inicioMin, fin: h.finMin })),
      despues: filas.map((h) => ({ dia: h.diaSemana, inicio: h.inicioMin, fin: h.finMin })),
    });
  });
  return { ok: true, mensaje: "Horario guardado. La web ya ofrece estas horas." };
}
