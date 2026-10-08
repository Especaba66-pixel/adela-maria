"use server";
import { revalidatePath } from "next/cache";
import { guardarDatosCentro, type Resultado } from "@/server/centro";

export async function guardar(_: Resultado | null, f: FormData): Promise<Resultado> {
  const r = await guardarDatosCentro({ telefono: String(f.get("telefono") ?? ""), direccion: String(f.get("direccion") ?? ""), cabinas: String(f.get("cabinas") ?? "") });
  revalidatePath("/", "layout");
  return r;
}
