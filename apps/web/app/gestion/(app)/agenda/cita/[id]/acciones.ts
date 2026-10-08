"use server";
import { ESTADOS_CITA, textoAHora, type EstadoCita } from "@adela/dominio";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cambiarEstadoCita, cancelarSerieDesde, moverCita } from "@/server/agenda";
import { requerirSesion } from "@/server/auth";

export async function cambiarEstado(_: { error?: string; ok?: string }, f: FormData): Promise<{ error?: string; ok?: string }> {
  const { usuario } = await requerirSesion("agenda.gestionar");
  const estado = String(f.get("estado"));
  if (!(ESTADOS_CITA as readonly string[]).includes(estado)) return { error: "Estado no válido." };
  const r = await cambiarEstadoCita(String(f.get("id")), estado as EstadoCita, usuario.id);
  revalidatePath("/gestion", "layout");
  return r.ok ? { ok: "Hecho." } : { error: r.error };
}

export async function mover(_: { error?: string; ok?: string }, f: FormData): Promise<{ error?: string; ok?: string }> {
  const { usuario } = await requerirSesion("agenda.gestionar");
  const hora = textoAHora(String(f.get("hora") ?? ""));
  if (hora === null) return { error: "Elige la hora." };
  const r = await moverCita(String(f.get("id")), String(f.get("fecha")), hora, String(f.get("profesional")), usuario.id);
  revalidatePath("/gestion", "layout");
  return r.ok ? { ok: "Cita cambiada de hora." } : { error: r.error };
}

export async function cancelarSerie(_: { error?: string; ok?: string }, f: FormData): Promise<{ error?: string; ok?: string }> {
  const { usuario } = await requerirSesion("agenda.gestionar");
  const id = String(f.get("id"));
  const r = await cancelarSerieDesde(id, usuario.id);
  if (!r.ok) return { error: r.error };
  revalidatePath("/gestion", "layout");
  // El botón desaparece al quedar cancelada: el aviso lo muestra la página.
  redirect(`/gestion/agenda/cita/${id}?canceladas=${r.valor}`);
}
