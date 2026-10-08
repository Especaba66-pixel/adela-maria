"use server";
import { revalidatePath } from "next/cache";
import { crearCategoria, guardarTratamiento, type Resultado } from "@/server/catalogo";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function guardar(_: Resultado | null, f: FormData): Promise<Resultado> {
  const r = await guardarTratamiento({
    id: texto(f, "id") || undefined,
    categoriaId: texto(f, "categoria"),
    nombre: texto(f, "nombre"),
    duracion: texto(f, "duracion"),
    precio: texto(f, "precio"),
    descripcion: texto(f, "descripcion"),
    retirado: f.get("retirado") === "on",
  });
  revalidatePath("/", "layout");
  return r;
}

export async function categoria(_: Resultado | null, f: FormData): Promise<Resultado> {
  const r = await crearCategoria(texto(f, "nombre"));
  revalidatePath("/", "layout");
  return r;
}
