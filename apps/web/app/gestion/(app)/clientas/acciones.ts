"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { anadirNota, anonimizarClienta, crearClienta, editarClienta } from "@/server/clientas";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "");
const datos = (f: FormData) => ({
  nombre: texto(f, "nombre"),
  telefono: texto(f, "telefono"),
  email: texto(f, "email"),
  fechaNacimiento: texto(f, "fechaNacimiento"),
  notas: texto(f, "notas"),
  aceptaAvisosCitas: f.get("aceptaAvisosCitas") === "on",
  aceptaPromociones: f.get("aceptaPromociones") === "on",
});

export async function crear(_: { error?: string; ok?: string }, f: FormData): Promise<{ error?: string; ok?: string }> {
  const r = await crearClienta(datos(f));
  if (!r.ok) return { error: r.error };
  redirect(`/gestion/clientas/${r.valor}`);
}

export async function editar(_: { error?: string; ok?: string }, f: FormData): Promise<{ error?: string; ok?: string }> {
  const id = texto(f, "id");
  const r = await editarClienta(id, datos(f));
  revalidatePath(`/gestion/clientas/${id}`);
  return r.ok ? { ok: "Ficha guardada." } : { error: r.error };
}

export async function nota(_: { error?: string; ok?: string }, f: FormData): Promise<{ error?: string; ok?: string }> {
  const id = texto(f, "id");
  const r = await anadirNota(id, texto(f, "texto"));
  revalidatePath(`/gestion/clientas/${id}`);
  return r.ok ? { ok: "Nota añadida." } : { error: r.error };
}

export async function suprimir(f: FormData) {
  const id = texto(f, "id");
  const r = await anonimizarClienta(id);
  if (r.ok) redirect("/gestion/clientas?suprimida=1");
}
