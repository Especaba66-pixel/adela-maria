"use server";
import { revalidatePath } from "next/cache";
import { crearUsuario, editarUsuario, type Resultado } from "@/server/usuarios";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function accionCrear(_: Resultado | null, f: FormData): Promise<Resultado> {
  const r = await crearUsuario({
    nombre: texto(f, "nombre"),
    usuario: texto(f, "usuario"),
    rol: texto(f, "rol"),
    contrasena: texto(f, "contrasena"),
    pin: texto(f, "pin"),
  });
  revalidatePath("/mas/configuracion/usuarios");
  return r;
}

export async function accionEditar(_: Resultado | null, f: FormData): Promise<Resultado> {
  const r = await editarUsuario(texto(f, "id"), {
    rol: texto(f, "rol") || undefined,
    activo: f.has("activo") ? f.get("activo") === "si" : undefined,
    contrasena: texto(f, "contrasena") || undefined,
    pin: texto(f, "pin") || undefined,
  });
  revalidatePath("/mas/configuracion/usuarios");
  return r;
}
