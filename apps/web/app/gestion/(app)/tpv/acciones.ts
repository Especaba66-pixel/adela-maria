"use server";
import { cobros, facturas } from "@adela/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { abrirCajon } from "@/server/impresora";
import { buscarClientas } from "@/server/clientas";
import { bonosDeClienta } from "@/server/bonos";
import { cobrarEnTpv, imprimirFactura, imprimirVale, venderTarjetaEnTpv, type PagoTpv, type PeticionCobro } from "@/server/tpv";

export async function cobrar(p: PeticionCobro): Promise<{ error: string }> {
  const r = await cobrarEnTpv(p);
  if (!r.ok) return { error: r.error };
  revalidatePath("/gestion", "layout");
  // Todo con bono: no hay ticket de venta; se enseña el bono con las sesiones que le quedan.
  if (!r.valor.facturaId) redirect(`/gestion/mas/bonos/${r.valor.bonosUsados[0]}?usada=1`);
  const q = new URLSearchParams({ cambio: String(r.valor.cambio), pendiente: String(r.valor.pendiente) });
  if (!r.valor.impresion.ok) q.set("impresion", r.valor.impresion.error);
  redirect(`/gestion/tpv/ticket/${r.valor.facturaId}?${q}`);
}

export async function venderTarjeta(d: { importe: number; para: string; deParte: string; clienteId?: string; pagos: PagoTpv[] }): Promise<{ error: string }> {
  const r = await venderTarjetaEnTpv(d);
  if (!r.ok) return { error: r.error };
  revalidatePath("/gestion", "layout");
  const q = new URLSearchParams({ cambio: String(r.valor.cambio), nueva: "1" });
  if (!r.valor.impresion.ok) q.set("impresion", r.valor.impresion.error);
  redirect(`/gestion/tpv/vale/${r.valor.tarjetaId}?${q}`);
}

export async function reimprimirVale(tarjetaId: string): Promise<{ ok?: string; error?: string }> {
  await requerirSesion("cobrar");
  const r = await imprimirVale(tarjetaId, false);
  return r.ok ? { ok: "Vale enviado a la impresora." } : { error: r.error };
}

/** Para elegir la clienta en el TPV. */
export async function buscarClienta(texto: string) {
  await requerirSesion("cobrar");
  return (await buscarClientas(texto, 8)).map((c) => ({ id: c.id, nombre: c.nombre, telefono: c.telefono }));
}

/** Bonos de la clienta que todavía se pueden usar. */
export async function bonosUsables(clienteId: string) {
  return (await bonosDeClienta(clienteId))
    .filter((b) => b.estado === "activo")
    .map((b) => ({ id: b.id, nombre: b.nombre, sesiones: b.sesiones, usadas: b.usadas, caducaEn: b.caducaEn, anulado: b.anulado, tratamientoIds: b.tratamientoIds, compradoEn: b.compradoEn }));
}

/** Saldo de una tarjeta regalo por su código. */
export async function consultarTarjeta(codigo: string): Promise<{ codigo: string; saldo: number } | { error: string }> {
  await requerirSesion("cobrar");
  const t = await cobros.tarjetaRegalo(db(), { codigo });
  if (!t) return { error: "No existe ninguna tarjeta regalo con ese código." };
  if (t.anulada) return { error: "Esa tarjeta regalo está anulada." };
  if (t.saldo <= 0) return { error: "Esa tarjeta regalo ya no tiene saldo." };
  return { codigo: t.codigo, saldo: t.saldo };
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
