"use server";
import { cobros, facturas } from "@adela/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { abrirCajon } from "@/server/impresora";
import { cobrarEnTpv, imprimirFactura, type PeticionCobro } from "@/server/tpv";

export async function cobrar(p: PeticionCobro): Promise<{ error: string }> {
  const r = await cobrarEnTpv(p);
  if (!r.ok) return { error: r.error };
  revalidatePath("/gestion", "layout");
  const q = new URLSearchParams({ cambio: String(r.valor.cambio), pendiente: String(r.valor.pendiente) });
  if (!r.valor.impresion.ok) q.set("impresion", r.valor.impresion.error);
  redirect(`/gestion/tpv/ticket/${r.valor.facturaId}?${q}`);
}

export async function reimprimir(facturaId: string): Promise<{ ok?: string; error?: string }> {
  await requerirSesion("cobrar");
  const r = await imprimirFactura(facturaId, false);
  return r.ok ? { ok: "Ticket enviado a la impresora." } : { error: r.error };
}

export async function cobrarDeuda(ventaId: string, pago: { metodo: "efectivo" | "tarjeta" | "bizum"; importe: number; entregado?: number }): Promise<{ error: string }> {
  const { usuario } = await requerirSesion("cobrar");
  const r = await cobros.cobrarPendiente(db(), usuario.id, ventaId, [pago]);
  if (!r.ok) return { error: r.error };
  if (pago.metodo === "efectivo") await abrirCajon();
  revalidatePath("/gestion", "layout");
  const [f] = await db().select({ id: facturas.id }).from(facturas).where(eq(facturas.ventaId, ventaId));
  redirect(`/gestion/tpv/ticket/${f!.id}?${new URLSearchParams({ cambio: String(r.valor.cambio), pendiente: String(r.valor.pendiente) })}`);
}
