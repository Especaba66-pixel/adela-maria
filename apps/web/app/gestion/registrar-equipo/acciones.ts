"use server";
import { redirect } from "next/navigation";
import { registrarEquipo } from "@/server/auth";

export async function registrar(_previo: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const r = await registrarEquipo({
    usuario: String(form.get("usuario") ?? ""),
    contrasena: String(form.get("contrasena") ?? ""),
    nombreEquipo: String(form.get("equipo") ?? ""),
  });
  if (!r.ok) return { error: r.error };
  redirect("/gestion");
}
