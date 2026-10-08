import "server-only";
import { categorias, registrarActividad, tratamientos } from "@adela/db";
import { eurosACentimos } from "@adela/dominio";
import { and, eq, ne } from "drizzle-orm";
import { requerirSesion } from "./auth";
import { db } from "./db";

export type Resultado = { ok: true; mensaje: string } | { ok: false; error: string };

export async function guardarTratamiento(d: {
  id?: string;
  categoriaId: string;
  nombre: string;
  duracion: string;
  precio: string;
  descripcion: string;
  retirado: boolean;
}): Promise<Resultado> {
  const { usuario } = await requerirSesion("configuracion.gestionar");
  const nombre = d.nombre.trim().replace(/\s+/g, " ");
  if (nombre.length < 2 || nombre.length > 80) return { ok: false, error: "Escribe el nombre." };
  // Vacío = por decidir.
  let duracionMinutos: number | null = null;
  if (d.duracion.trim()) {
    duracionMinutos = Number(d.duracion);
    if (!Number.isInteger(duracionMinutos) || duracionMinutos <= 0 || duracionMinutos % 5 !== 0 || duracionMinutos > 600) {
      return { ok: false, error: "La duración va en minutos, de 5 en 5." };
    }
  }
  let precioCentimos: number | null = null;
  if (d.precio.trim()) {
    precioCentimos = eurosACentimos(d.precio);
    if (precioCentimos === null) return { ok: false, error: "Revisa el precio (por ejemplo: 45 o 12,50)." };
  }
  const [cat] = await db().select().from(categorias).where(eq(categorias.id, d.categoriaId));
  if (!cat) return { ok: false, error: "Elige la categoría." };
  const [repetido] = await db()
    .select({ id: tratamientos.id })
    .from(tratamientos)
    .where(and(eq(tratamientos.categoriaId, d.categoriaId), eq(tratamientos.nombre, nombre), d.id ? ne(tratamientos.id, d.id) : undefined));
  if (repetido) return { ok: false, error: "Ya hay un tratamiento con ese nombre en esa categoría." };

  const valores = {
    categoriaId: d.categoriaId,
    nombre,
    duracionMinutos,
    precioCentimos,
    descripcion: d.descripcion.trim() || null,
    anuladoEn: d.retirado ? new Date() : null,
  };
  await db().transaction(async (tx) => {
    if (d.id) {
      const [antes] = await tx.select().from(tratamientos).where(eq(tratamientos.id, d.id));
      // Al retirar, se conserva la fecha original si ya estaba retirado.
      if (antes?.anuladoEn && d.retirado) valores.anuladoEn = antes.anuladoEn;
      const [despues] = await tx.update(tratamientos).set(valores).where(eq(tratamientos.id, d.id)).returning();
      await registrarActividad(tx, { usuarioId: usuario.id, accion: "tratamiento.editar", entidad: "tratamientos", entidadId: d.id, antes, despues });
    } else {
      const [nuevo] = await tx.insert(tratamientos).values({ ...valores, orden: 999 }).returning();
      await registrarActividad(tx, { usuarioId: usuario.id, accion: "tratamiento.crear", entidad: "tratamientos", entidadId: nuevo!.id, despues: nuevo });
    }
  });
  return { ok: true, mensaje: d.id ? "Tratamiento guardado." : "Tratamiento añadido." };
}

export async function crearCategoria(nombre: string): Promise<Resultado> {
  const { usuario } = await requerirSesion("configuracion.gestionar");
  const n = nombre.trim();
  if (n.length < 2 || n.length > 40) return { ok: false, error: "Escribe el nombre de la categoría." };
  const [existe] = await db().select({ id: categorias.id }).from(categorias).where(eq(categorias.nombre, n));
  if (existe) return { ok: false, error: "Esa categoría ya existe." };
  const [c] = await db().insert(categorias).values({ nombre: n, orden: 99 }).returning();
  await registrarActividad(db(), { usuarioId: usuario.id, accion: "categoria.crear", entidad: "categorias", entidadId: c!.id, despues: c });
  return { ok: true, mensaje: "Categoría creada." };
}
