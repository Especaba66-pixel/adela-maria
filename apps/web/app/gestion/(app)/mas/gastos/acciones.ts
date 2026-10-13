"use server";
import { stock } from "@adela/db";
import { CATEGORIAS_GASTO, type CategoriaGasto } from "@adela/dominio";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { leerEuros, leerIva } from "@/server/stock";

export type Estado = { ok: true; mensaje: string } | { ok: false; error: string } | null;
const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function anotarGasto(_: Estado, f: FormData): Promise<Estado> {
  const { usuario } = await requerirSesion("gastos.gestionar");
  const total = leerEuros(texto(f, "total"));
  const iva = leerIva(texto(f, "iva"));
  if (total == null) return { ok: false, error: "Revisa el importe (por ejemplo: 121,00)." };
  if (iva == null) return { ok: false, error: "Revisa el IVA (por ejemplo: 21, o 0 si no lleva)." };
  const categoria = texto(f, "categoria");
  if (!(CATEGORIAS_GASTO as readonly string[]).includes(categoria)) return { ok: false, error: "Elige el tipo de gasto." };
  const r = await stock.registrarGasto(db(), usuario.id, {
    fecha: texto(f, "fecha"),
    categoria: categoria as CategoriaGasto,
    concepto: texto(f, "concepto"),
    proveedorId: texto(f, "proveedor") || null,
    numeroFactura: texto(f, "factura"),
    total,
    ivaCentesimas: iva,
    pagoCaja: f.get("caja") === "on",
  });
  if (!r.ok) return r;
  revalidatePath("/gestion", "layout");
  return { ok: true, mensaje: `Gasto «${texto(f, "concepto")}» anotado.` };
}

export async function anular(f: FormData) {
  const { usuario } = await requerirSesion("gastos.gestionar");
  await stock.anularGasto(db(), usuario.id, String(f.get("id")));
  revalidatePath("/gestion", "layout");
}
