"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearCategoria, guardarTratamiento, ivaParaTodos, type Resultado } from "@/server/catalogo";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function guardar(_: Resultado | null, f: FormData): Promise<Resultado> {
  const r = await guardarTratamiento({
    id: texto(f, "id") || undefined,
    categoriaId: texto(f, "categoria"),
    nombre: texto(f, "nombre"),
    duracion: texto(f, "duracion"),
    precio: texto(f, "precio"),
    iva: texto(f, "iva"),
    descripcion: texto(f, "descripcion"),
    exclusivo: f.get("exclusivo") === "on",
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

export async function ivaTodos(_: Resultado | null, f: FormData): Promise<Resultado> {
  const r = await ivaParaTodos(texto(f, "iva"));
  if (!r.ok) return r;
  revalidatePath("/gestion", "layout");
  // El cuadro desaparece al no quedar tratamientos sin IVA: el aviso lo muestra la página.
  redirect(`/gestion/mas/tratamientos?${new URLSearchParams({ iva: String(r.iva), cambiados: String(r.cambiados) })}`);
}
