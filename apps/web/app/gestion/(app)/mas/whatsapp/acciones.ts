"use server";
import { plantillas, registrarActividad } from "@adela/db";
import { validarPlantilla } from "@adela/dominio";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";

export type Estado = { ok: true; mensaje: string } | { ok: false; error: string } | null;

export async function guardarPlantilla(_: Estado, f: FormData): Promise<Estado> {
  const { usuario } = await requerirSesion("configuracion.gestionar");
  const clave = String(f.get("clave") ?? "");
  const texto = String(f.get("texto") ?? "").trim();
  const e = validarPlantilla(texto);
  if (e) return { ok: false, error: e };
  await db().transaction(async (tx) => {
    const [p] = await tx.update(plantillas).set({ texto, actualizadaEn: new Date() }).where(eq(plantillas.clave, clave)).returning();
    if (!p) throw new Error("No existe la plantilla");
    await registrarActividad(tx, { usuarioId: usuario.id, accion: "plantilla.editar", entidad: "plantillas", despues: { clave, texto } });
  });
  revalidatePath("/gestion", "layout");
  return { ok: true, mensaje: "Guardado." };
}
