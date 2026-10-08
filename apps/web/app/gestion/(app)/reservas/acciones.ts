"use server";
import { revalidatePath } from "next/cache";
import { cambiarEstadoCita } from "@/server/agenda";
import { requerirSesion } from "@/server/auth";
import { gestionarSolicitud } from "@/server/reservas";

function refrescar() {
  revalidatePath("/gestion", "layout");
}

export async function confirmar(f: FormData) {
  await gestionarSolicitud(String(f.get("id")), "confirmada");
  refrescar();
}

export async function rechazar(f: FormData) {
  await gestionarSolicitud(String(f.get("id")), "rechazada");
  refrescar();
}

/** Citas pedidas en la web con hora: confirmar o rechazar (rechazar = cancelar y liberar el hueco). */
export async function confirmarCita(f: FormData) {
  const { usuario } = await requerirSesion("reservas.gestionar");
  await cambiarEstadoCita(String(f.get("id")), "confirmada", usuario.id);
  refrescar();
}

export async function rechazarCita(f: FormData) {
  const { usuario } = await requerirSesion("reservas.gestionar");
  await cambiarEstadoCita(String(f.get("id")), "cancelada", usuario.id);
  refrescar();
}
