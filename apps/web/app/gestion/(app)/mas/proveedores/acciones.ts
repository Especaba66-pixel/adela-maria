"use server";
import { stock } from "@adela/db";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";

export type Estado = { ok: true; mensaje: string } | { ok: false; error: string } | null;
const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function guardarProveedor(_: Estado, f: FormData): Promise<Estado> {
  const { usuario } = await requerirSesion("stock.gestionar");
  const id = texto(f, "id") || undefined;
  const r = await stock.guardarProveedor(db(), usuario.id, {
    id,
    nombre: texto(f, "nombre"),
    nif: texto(f, "nif"),
    telefono: texto(f, "telefono"),
    email: texto(f, "email"),
    notas: texto(f, "notas"),
  });
  if (!r.ok) return r;
  revalidatePath("/gestion", "layout");
  return { ok: true, mensaje: id ? "Guardado." : `«${texto(f, "nombre")}» añadido.` };
}
