"use server";
import { cobros } from "@adela/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { abrirCajon } from "@/server/impresora";

type Estado = { ok?: string; error?: string };
const refrescar = () => revalidatePath("/gestion", "layout");

export async function abrir(centimos: number): Promise<Estado> {
  const { usuario } = await requerirSesion("caja.abrir_cerrar");
  const r = await cobros.abrirCaja(db(), usuario.id, centimos);
  refrescar();
  return r.ok ? { ok: "Caja abierta." } : { error: r.error };
}

export async function movimiento(tipo: "entrada" | "salida", centimos: number, concepto: string): Promise<Estado> {
  const { usuario } = await requerirSesion("caja.abrir_cerrar");
  const r = await cobros.movimientoManual(db(), usuario.id, { tipo, importe: centimos, concepto });
  if (r.ok) await abrirCajon();
  refrescar();
  return r.ok ? { ok: tipo === "entrada" ? "Entrada anotada." : "Salida anotada." } : { error: r.error };
}

export async function cerrar(centimos: number, notas: string): Promise<Estado> {
  const { usuario } = await requerirSesion("caja.abrir_cerrar");
  const r = await cobros.cerrarCaja(db(), usuario.id, centimos, notas);
  if (!r.ok) return { error: r.error };
  refrescar();
  // La pantalla pasa a «Abrir caja»: el resultado del cierre lo muestra la página.
  redirect(`/gestion/caja?cierre=${r.valor.diferencia}`);
}

export async function cajonAccion(): Promise<Estado> {
  await requerirSesion("caja.abrir_cerrar");
  const r = await abrirCajon();
  return r.ok ? { ok: r.detalle } : { error: r.error };
}
