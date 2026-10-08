"use server";
import { bloqueos, registrarActividad } from "@adela/db";
import { esFecha, instanteMadrid, sumarDias, textoAHora } from "@adela/dominio";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function crearBloqueo(_: { error?: string; ok?: string }, f: FormData): Promise<{ error?: string; ok?: string }> {
  const { usuario } = await requerirSesion("agenda.gestionar");
  const desde = texto(f, "desde");
  const hasta = texto(f, "hasta") || desde;
  if (!esFecha(desde) || !esFecha(hasta) || hasta < desde) return { error: "Revisa los días." };
  const diaEntero = f.get("diaEntero") === "on";
  let inicio: Date;
  let fin: Date;
  if (diaEntero) {
    inicio = instanteMadrid(desde, 0);
    fin = instanteMadrid(sumarDias(hasta, 1), 0);
  } else {
    const hi = textoAHora(texto(f, "horaDesde"));
    const hf = textoAHora(texto(f, "horaHasta"));
    if (hi === null || hf === null) return { error: "Pon las horas o marca «Días enteros»." };
    inicio = instanteMadrid(desde, hi);
    fin = instanteMadrid(hasta, hf);
    if (fin <= inicio) return { error: "El final tiene que ser después del principio." };
  }
  const tipo = texto(f, "tipo");
  if (!["vacaciones", "descanso", "otro"].includes(tipo)) return { error: "Elige el tipo." };
  const profesionalId = texto(f, "profesional") || null;
  await db().transaction(async (tx) => {
    const [b] = await tx
      .insert(bloqueos)
      .values({ profesionalId, inicio, fin, tipo: tipo as "vacaciones", motivo: texto(f, "motivo") || null, creadoPor: usuario.id })
      .returning();
    await registrarActividad(tx, { usuarioId: usuario.id, accion: "bloqueo.crear", entidad: "bloqueos", entidadId: b!.id, despues: b });
  });
  revalidatePath("/gestion/agenda", "layout");
  return { ok: "Bloqueo guardado. Esas horas ya no se ofrecen en la web." };
}

export async function quitarBloqueo(f: FormData) {
  const { usuario } = await requerirSesion("agenda.gestionar");
  const id = String(f.get("id"));
  await db().transaction(async (tx) => {
    await tx.update(bloqueos).set({ anuladoEn: new Date() }).where(and(eq(bloqueos.id, id), isNull(bloqueos.anuladoEn)));
    await registrarActividad(tx, { usuarioId: usuario.id, accion: "bloqueo.quitar", entidad: "bloqueos", entidadId: id });
  });
  revalidatePath("/gestion/agenda", "layout");
}
