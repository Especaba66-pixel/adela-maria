"use server";
import { leerPorcentaje } from "@adela/dominio";
import { revalidatePath } from "next/cache";
import { guardarProfesional, type Resultado } from "@/server/equipo";

export async function guardar(_: Resultado | null, f: FormData): Promise<Resultado> {
  const r = await guardarProfesional({
    id: String(f.get("id") ?? "") || undefined,
    nombre: String(f.get("nombre") ?? ""),
    color: String(f.get("color") ?? "#b08d57"),
    usuarioId: String(f.get("usuario") ?? ""),
    activo: f.get("activo") !== "no",
    tratamientoIds: f.getAll("tratamiento").map(String),
    comisionServicios: leerPorcentaje(String(f.get("comisionServicios") ?? "")),
    comisionProductos: leerPorcentaje(String(f.get("comisionProductos") ?? "")),
  });
  revalidatePath("/gestion", "layout");
  return r;
}
