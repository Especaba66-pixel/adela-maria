"use server";
import { cobros, facturas } from "@adela/db";
import { METODOS_PAGO, type MetodoPago } from "@adela/dominio";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { abrirCajon } from "@/server/impresora";
import { imprimirFactura } from "@/server/tpv";

export async function devolver(_: { error?: string }, f: FormData): Promise<{ error?: string }> {
  const { usuario } = await requerirSesion("facturas.anular");
  const facturaId = String(f.get("factura"));
  const metodo = String(f.get("metodo"));
  if (!(METODOS_PAGO as readonly string[]).includes(metodo)) return { error: "Elige cómo se devuelve el dinero." };
  const [original] = await db().select().from(facturas).where(eq(facturas.id, facturaId));
  if (!original) return { error: "No existe esa factura." };
  const r = await cobros.devolver(db(), usuario.id, original.ventaId, metodo as MetodoPago, String(f.get("motivo") ?? ""));
  if (!r.ok) return { error: r.error };
  const [rect] = await db().select().from(facturas).where(eq(facturas.numeroCompleto, r.valor.numero));
  if (metodo === "efectivo") await abrirCajon();
  await imprimirFactura(rect!.id, false);
  revalidatePath("/gestion", "layout");
  redirect(`/gestion/mas/facturacion/${rect!.id}`);
}
