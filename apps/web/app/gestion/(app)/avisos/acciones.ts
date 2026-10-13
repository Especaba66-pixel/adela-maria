"use server";
import { tareas } from "@adela/db";
import { hoyEnMadrid, sumarDias } from "@adela/dominio";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth";
import { atenderAviso } from "@/server/avisos";
import { db } from "@/server/db";

const refrescar = () => revalidatePath("/gestion", "layout");

/** Aviso hecho: deja de salir. */
export async function hecho(f: FormData) {
  const { usuario } = await requerirSesion();
  await atenderAviso(String(f.get("clave")), usuario.id, null);
  refrescar();
}

/** Aviso para mañana. */
export async function posponer(f: FormData) {
  const { usuario } = await requerirSesion();
  await atenderAviso(String(f.get("clave")), usuario.id, sumarDias(hoyEnMadrid(new Date()), 0));
  refrescar();
}

export async function tareaHecha(f: FormData) {
  const { usuario } = await requerirSesion();
  await db()
    .update(tareas)
    .set({ hechaEn: new Date(), hechaPor: usuario.id })
    .where(and(eq(tareas.id, String(f.get("id"))), isNull(tareas.hechaEn)));
  refrescar();
}

export type Estado = { ok: true; mensaje: string } | { ok: false; error: string } | null;

export async function nuevaTarea(_: Estado, f: FormData): Promise<Estado> {
  const { usuario } = await requerirSesion();
  const texto = String(f.get("texto") ?? "").trim();
  const fecha = String(f.get("fecha") ?? "").trim();
  const clienteId = String(f.get("cliente") ?? "").trim();
  if (texto.length < 2 || texto.length > 300) return { ok: false, error: "Escribe qué hay que hacer." };
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: "Revisa la fecha." };
  await db().insert(tareas).values({ texto, fecha: fecha || null, clienteId: clienteId || null, creadaPor: usuario.id });
  refrescar();
  return { ok: true, mensaje: `Tarea apuntada: «${texto}».` };
}
