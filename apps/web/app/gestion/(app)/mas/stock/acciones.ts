"use server";
import { stock } from "@adela/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { leerEuros, leerIva } from "@/server/stock";

export type Estado = { ok: true; mensaje: string } | { ok: false; error: string } | null;
const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const refrescar = () => revalidatePath("/gestion", "layout");

export async function guardarProducto(_: Estado, f: FormData): Promise<Estado> {
  const { usuario } = await requerirSesion("stock.gestionar");
  const precio = leerEuros(texto(f, "precio"));
  const iva = leerIva(texto(f, "iva"));
  if (precio === undefined) return { ok: false, error: "Revisa el precio (por ejemplo: 12,50)." };
  if (iva === undefined) return { ok: false, error: "Revisa el IVA (por ejemplo: 21)." };
  const minimo = Number(texto(f, "minimo") || "0");
  const id = texto(f, "id") || undefined;
  const r = await stock.guardarProducto(db(), usuario.id, {
    id,
    nombre: texto(f, "nombre"),
    uso: texto(f, "uso"),
    referencia: texto(f, "referencia"),
    precio,
    iva,
    stockMinimo: Number.isInteger(minimo) ? minimo : -1,
    proveedorId: texto(f, "proveedor") || null,
  });
  if (!r.ok) return r;
  refrescar();
  return { ok: true, mensaje: id ? "Guardado." : `«${texto(f, "nombre")}» añadido.` };
}

export async function contar(_: Estado, f: FormData): Promise<Estado> {
  const { usuario } = await requerirSesion("stock.gestionar");
  const contado = Number(texto(f, "contado"));
  const r = await stock.contarExistencias(db(), usuario.id, texto(f, "id"), Number.isInteger(contado) && texto(f, "contado") ? contado : -1, texto(f, "motivo"));
  if (!r.ok) return r;
  refrescar();
  return { ok: true, mensaje: r.valor === 0 ? "Cuadra: no había diferencia." : `Recuento anotado (${r.valor > 0 ? "+" : ""}${r.valor}).` };
}

export async function merma(_: Estado, f: FormData): Promise<Estado> {
  const { usuario } = await requerirSesion("stock.gestionar");
  const r = await stock.anotarMerma(db(), usuario.id, texto(f, "id"), Number(texto(f, "cantidad")), texto(f, "motivo"));
  if (!r.ok) return r;
  refrescar();
  return { ok: true, mensaje: "Anotado." };
}

export async function consumo(_: Estado, f: FormData): Promise<Estado> {
  const { usuario } = await requerirSesion("stock.gestionar");
  const r = await stock.fijarConsumo(db(), usuario.id, texto(f, "id"), texto(f, "tratamiento"), Number(texto(f, "cantidad") || "0"));
  if (!r.ok) return r;
  refrescar();
  return { ok: true, mensaje: "Guardado." };
}

export interface LineaCompraForm {
  productoId: string;
  cantidad: string;
  coste: string;
}

export async function comprar(d: { proveedorId: string; fecha: string; numeroFactura: string; iva: string; lineas: LineaCompraForm[] }): Promise<{ error: string }> {
  const { usuario } = await requerirSesion("stock.gestionar");
  const iva = leerIva(d.iva);
  if (iva == null) return { error: "Revisa el IVA de la factura (por ejemplo: 21)." };
  const lineas = [];
  for (const l of d.lineas.filter((x) => x.productoId)) {
    const coste = leerEuros(l.coste);
    const cantidad = Number(l.cantidad);
    if (coste == null || !Number.isInteger(cantidad) || cantidad <= 0) return { error: "Revisa las cantidades y los costes (por ejemplo: 3 y 4,20)." };
    lineas.push({ productoId: l.productoId, cantidad, costeUnitario: coste });
  }
  const r = await stock.registrarCompra(db(), usuario.id, { proveedorId: d.proveedorId, fecha: d.fecha, numeroFactura: d.numeroFactura, ivaCentesimas: iva, lineas });
  if (!r.ok) return { error: r.error };
  refrescar();
  redirect(`/gestion/mas/stock?compra=${r.valor.total}`);
}
