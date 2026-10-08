"use server";
import { dispositivos, registrarActividad, sesiones } from "@adela/db";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";

export async function revocarEquipo(f: FormData) {
  const { usuario } = await requerirSesion("configuracion.gestionar");
  const id = String(f.get("id"));
  await db().transaction(async (tx) => {
    await tx.update(dispositivos).set({ revocadoEn: new Date() }).where(and(eq(dispositivos.id, id), isNull(dispositivos.revocadoEn)));
    await tx.update(sesiones).set({ cerradaEn: new Date() }).where(and(eq(sesiones.dispositivoId, id), isNull(sesiones.cerradaEn)));
    await registrarActividad(tx, { usuarioId: usuario.id, accion: "dispositivo.revocar", entidad: "dispositivos", entidadId: id });
  });
  revalidatePath("/mas/configuracion/equipos");
}
