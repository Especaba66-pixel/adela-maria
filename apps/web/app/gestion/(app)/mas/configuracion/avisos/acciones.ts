"use server";
import { centro, registrarActividad } from "@adela/db";
import { leerAjustesAvisos } from "@adela/dominio";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";

export type Estado = { ok: true; mensaje: string } | { ok: false; error: string } | null;

export async function guardarAjustes(_: Estado, f: FormData): Promise<Estado> {
  const { usuario } = await requerirSesion("configuracion.gestionar");
  const dias = Number(String(f.get("dias") ?? "").trim() || "0");
  if (!Number.isInteger(dias) || dias < 0 || dias > 730) return { ok: false, error: "Los días van de 0 a 730 (0 = no avisar)." };
  const ajustes = leerAjustesAvisos({
    recordatorios: f.get("recordatorios") === "on",
    seguimiento: f.get("seguimiento") === "on",
    bonos: f.get("bonos") === "on",
    cumpleanos: f.get("cumpleanos") === "on",
    diasInactiva: dias,
  });
  await db().transaction(async (tx) => {
    await tx.update(centro).set({ avisos: ajustes });
    await registrarActividad(tx, { usuarioId: usuario.id, accion: "avisos.configurar", entidad: "centro", despues: ajustes });
  });
  revalidatePath("/gestion", "layout");
  return { ok: true, mensaje: "Guardado." };
}
