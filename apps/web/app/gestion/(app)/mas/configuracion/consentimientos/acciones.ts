"use server";
import { revalidatePath } from "next/cache";
import { guardarModelo } from "@/server/fichas";

export type Estado = { ok: true; mensaje: string } | { ok: false; error: string } | null;

export async function guardar(_: Estado, f: FormData): Promise<Estado> {
  const r = await guardarModelo({
    id: String(f.get("id") ?? "") || undefined,
    nombre: String(f.get("nombre") ?? ""),
    texto: String(f.get("texto") ?? ""),
    activo: f.get("activo") !== "no",
    tratamientoIds: f.getAll("tratamiento").map(String),
  });
  revalidatePath("/gestion", "layout");
  return r.ok ? { ok: true, mensaje: "Guardado." } : { ok: false, error: r.error };
}
