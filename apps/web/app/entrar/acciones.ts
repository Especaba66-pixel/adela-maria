"use server";
import { redirect } from "next/navigation";
import { entrarConContrasena } from "@/server/auth";

export async function entrar(_previo: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const r = await entrarConContrasena({
    usuario: String(form.get("usuario") ?? ""),
    contrasena: String(form.get("contrasena") ?? ""),
    recordarComoTpv: form.get("tpv") === "on",
  });
  if (!r.ok) return { error: r.error };
  redirect("/");
}
