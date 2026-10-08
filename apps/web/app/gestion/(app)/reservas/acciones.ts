"use server";
import { revalidatePath } from "next/cache";
import { gestionarSolicitud } from "@/server/reservas";

export async function confirmar(f: FormData) {
  await gestionarSolicitud(String(f.get("id")), "confirmada");
  revalidatePath("/gestion/reservas");
  revalidatePath("/gestion");
}

export async function rechazar(f: FormData) {
  await gestionarSolicitud(String(f.get("id")), "rechazada");
  revalidatePath("/gestion/reservas");
  revalidatePath("/gestion");
}
