"use server";
import { cobros } from "@adela/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";

export async function devolverSesion(_: { error?: string }, f: FormData): Promise<{ error?: string }> {
  const { usuario } = await requerirSesion("bonos.corregir");
  const id = String(f.get("bono"));
  const r = await cobros.devolverSesion(db(), usuario.id, id, String(f.get("motivo") ?? ""));
  if (!r.ok) return { error: r.error };
  revalidatePath("/gestion", "layout");
  redirect(`/gestion/mas/bonos/${id}?devuelta=1`);
}
