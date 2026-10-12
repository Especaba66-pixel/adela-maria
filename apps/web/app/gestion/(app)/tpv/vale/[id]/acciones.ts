"use server";
import { cobros } from "@adela/db";
import { METODOS_CAJA, type MetodoPago } from "@adela/dominio";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { abrirCajon } from "@/server/impresora";

export async function devolverTarjeta(_: { error?: string }, f: FormData): Promise<{ error?: string }> {
  const { usuario } = await requerirSesion("facturas.anular");
  const id = String(f.get("tarjeta"));
  const metodo = String(f.get("metodo"));
  if (!(METODOS_CAJA as readonly string[]).includes(metodo)) return { error: "Elige cómo se devuelve el dinero." };
  const r = await cobros.devolverTarjetaRegalo(db(), usuario.id, id, metodo as MetodoPago, String(f.get("motivo") ?? ""));
  if (!r.ok) return { error: r.error };
  if (metodo === "efectivo") await abrirCajon();
  revalidatePath("/gestion", "layout");
  redirect(`/gestion/tpv/vale/${id}?devuelta=1`);
}
