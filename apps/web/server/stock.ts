import "server-only";
import { categorias, consumosTratamiento, facturas, gastos, movimientosStock, productos, proveedores, compras, lineasCompra, stock, tratamientos, usuarios } from "@adela/db";
import { eurosACentimos, stockBajo, trimestre } from "@adela/dominio";
import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "./db";

/** «12,50» → 1250; vacío → null; mal escrito → undefined. */
export function leerEuros(texto: string): number | null | undefined {
  if (!texto.trim()) return null;
  return eurosACentimos(texto) ?? undefined;
}

/** «21» o «10,5» → centésimas (2100, 1050); vacío → null; mal escrito → undefined. */
export function leerIva(texto: string): number | null | undefined {
  if (!texto.trim()) return null;
  const n = Number(texto.trim().replace(",", ".").replace("%", ""));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) : undefined;
}

export const productosConStock = () => stock.listaProductos(db());

export async function contarStockBajo(): Promise<number> {
  return (await productosConStock()).filter((p) => p.bajo).length;
}

/** Ficha de un producto: datos, stock, historial y lo que se gasta en cada tratamiento. */
export async function fichaProducto(id: string) {
  const [p] = await db().select().from(productos).where(eq(productos.id, id));
  if (!p) return null;
  const [historial, consumos, lista, stockActual] = await Promise.all([
    db()
      .select({ m: movimientosStock, quien: usuarios.nombre })
      .from(movimientosStock)
      .innerJoin(usuarios, eq(usuarios.id, movimientosStock.usuarioId))
      .where(eq(movimientosStock.productoId, id))
      .orderBy(desc(movimientosStock.id))
      .limit(100),
    db().select().from(consumosTratamiento).where(eq(consumosTratamiento.productoId, id)),
    db()
      .select({ id: tratamientos.id, nombre: tratamientos.nombre, categoria: categorias.nombre })
      .from(tratamientos)
      .innerJoin(categorias, eq(categorias.id, tratamientos.categoriaId))
      .where(isNull(tratamientos.anuladoEn))
      .orderBy(asc(categorias.orden), asc(tratamientos.orden)),
    stock.stockDeProducto(db(), id),
  ]);
  return {
    producto: p,
    stock: stockActual,
    bajo: stockBajo(stockActual, p.stockMinimo),
    historial,
    tratamientos: lista.map((t) => ({ ...t, consumo: consumos.find((c) => c.tratamientoId === t.id)?.cantidad ?? 0 })),
  };
}

export async function listaProveedores() {
  return db()
    .select({
      p: proveedores,
      compras: sql<number>`(select count(*) from compras c where c.proveedor_id = "proveedores"."id")::int`,
      gastado: sql<number>`coalesce((select sum(g.total) from gastos g where g.proveedor_id = "proveedores"."id" and g.anulado_en is null), 0)::int`,
    })
    .from(proveedores)
    .where(isNull(proveedores.anuladoEn))
    .orderBy(asc(proveedores.nombre));
}

/** Últimas compras, con su proveedor y su total (del gasto que generaron). */
export async function ultimasCompras(limite = 20) {
  return db()
    .select({ c: compras, proveedor: proveedores.nombre, total: gastos.total, lineas: sql<number>`(select count(*) from lineas_compra l where l.compra_id = "compras"."id")::int` })
    .from(compras)
    .innerJoin(proveedores, eq(proveedores.id, compras.proveedorId))
    .leftJoin(gastos, eq(gastos.compraId, compras.id))
    .orderBy(desc(compras.fecha), desc(compras.creadaEn))
    .limit(limite);
}

export async function lineasDeCompra(compraId: string) {
  return db()
    .select({ l: lineasCompra, producto: productos.nombre })
    .from(lineasCompra)
    .innerJoin(productos, eq(productos.id, lineasCompra.productoId))
    .where(eq(lineasCompra.compraId, compraId))
    .orderBy(asc(lineasCompra.orden));
}

/** Gastos de un trimestre y el resumen de IVA (repercutido en las facturas emitidas menos soportado en los gastos). */
export async function trimestreFiscal(fecha: string) {
  const t = trimestre(fecha);
  const [lista, emitidas] = await Promise.all([
    db()
      .select({ g: gastos, proveedor: proveedores.nombre, nif: proveedores.nif })
      .from(gastos)
      .leftJoin(proveedores, eq(proveedores.id, gastos.proveedorId))
      .where(and(gte(gastos.fecha, t.desde), lte(gastos.fecha, t.hasta)))
      .orderBy(desc(gastos.fecha), desc(gastos.creadoEn)),
    db()
      .select()
      .from(facturas)
      .where(and(gte(facturas.fechaExpedicion, t.desde), lte(facturas.fechaExpedicion, t.hasta)))
      .orderBy(asc(facturas.fechaExpedicion), asc(facturas.numeroCompleto)),
  ]);
  const vigentes = lista.filter((x) => !x.g.anuladoEn);
  return {
    trimestre: t,
    gastos: lista,
    facturas: emitidas,
    resumen: {
      ventasBase: emitidas.reduce((s, f) => s + f.baseTotal, 0),
      ivaRepercutido: emitidas.reduce((s, f) => s + f.cuotaTotal, 0),
      gastosBase: vigentes.reduce((s, x) => s + x.g.base, 0),
      ivaSoportado: vigentes.reduce((s, x) => s + x.g.cuota, 0),
      gastosTotal: vigentes.reduce((s, x) => s + x.g.total, 0),
    },
  };
}
