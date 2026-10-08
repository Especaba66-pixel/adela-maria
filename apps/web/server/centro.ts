import "server-only";
import { centro, registrarActividad } from "@adela/db";
import { normalizarTelefono } from "@adela/dominio";
import { eq } from "drizzle-orm";
import { requerirSesion } from "./auth";
import { db } from "./db";

export type Resultado = { ok: true; mensaje: string } | { ok: false; error: string };

/** Datos del centro que se ven en la web de clientas. Solo administración. */
export async function guardarDatosCentro(datos: { telefono: string; direccion: string }): Promise<Resultado> {
  const { usuario } = await requerirSesion("configuracion.gestionar");
  let telefono: string | null = null;
  if (datos.telefono.trim()) {
    telefono = normalizarTelefono(datos.telefono);
    if (!telefono) return { ok: false, error: "Revisa el teléfono: debe ser un número español de 9 cifras." };
  }
  const direccion = datos.direccion.trim().replace(/\s+/g, " ") || null;
  if (direccion && direccion.length > 200) return { ok: false, error: "La dirección es demasiado larga." };

  const [antes] = await db().select().from(centro).limit(1);
  if (!antes) return { ok: false, error: "No hay datos del centro." };
  await db().transaction(async (tx) => {
    const [despues] = await tx.update(centro).set({ telefono, direccion }).where(eq(centro.id, antes.id)).returning();
    await registrarActividad(tx, { usuarioId: usuario.id, accion: "centro.editar", entidad: "centro", entidadId: antes.id, antes, despues });
  });
  return { ok: true, mensaje: "Guardado. Ya se ve en la web de clientas." };
}
