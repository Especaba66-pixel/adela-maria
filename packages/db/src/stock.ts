/**
 * Stock, proveedores, compras y gastos. Cada operación es «todo o nada».
 */
import {
  desglosarTotal,
  partesMadrid,
  stockBajo,
  totalCompra,
  validarProducto,
  type CategoriaGasto,
  type DatosProducto,
} from "@adela/dominio";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { registrarActividad } from "./actividad";
import { cajaAbierta, resumenCaja, type Resultado } from "./cobros";
import { compras, consumosTratamiento, gastos, lineasCompra, movimientosCaja, movimientosStock, productos, proveedores } from "./esquema";
import type { BaseDatos, Tx } from "./index";

const error = (e: string) => ({ ok: false as const, error: e });
const textoONull = (t?: string | null) => t?.trim() || null;

// ── Productos ────────────────────────────────────────────────────────────────

const existencias = sql<number>`coalesce((select sum(m.cantidad) from movimientos_stock m where m.producto_id = "productos"."id"), 0)::int`;

/** Productos activos con su stock y si hay que reponer. */
export async function listaProductos(db: BaseDatos | Tx) {
  const filas = await db
    .select({ p: productos, stock: existencias, proveedor: proveedores.nombre })
    .from(productos)
    .leftJoin(proveedores, eq(proveedores.id, productos.proveedorId))
    .where(isNull(productos.anuladoEn))
    .orderBy(asc(productos.nombre));
  return filas.map(({ p, stock, proveedor }) => ({ ...p, stock, proveedor, bajo: stockBajo(stock, p.stockMinimo) }));
}

export async function stockDeProducto(db: BaseDatos | Tx, productoId: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`coalesce(sum(${movimientosStock.cantidad}), 0)::int` }).from(movimientosStock).where(eq(movimientosStock.productoId, productoId));
  return r?.n ?? 0;
}

export async function guardarProducto(
  db: BaseDatos,
  usuarioId: string,
  d: DatosProducto & { id?: string; proveedorId?: string | null },
): Promise<Resultado<string>> {
  const e = validarProducto(d);
  if (e) return error(e);
  const valores = {
    nombre: d.nombre.trim(),
    uso: d.uso as "venta" | "cabina",
    referencia: textoONull(d.referencia),
    precioCentimos: d.uso === "venta" ? (d.precio ?? null) : null,
    ivaCentesimas: d.uso === "venta" ? (d.iva ?? null) : null,
    stockMinimo: d.stockMinimo,
    proveedorId: d.proveedorId || null,
  };
  try {
    const id = await db.transaction(async (tx) => {
      const [p] = d.id
        ? await tx.update(productos).set(valores).where(eq(productos.id, d.id)).returning()
        : await tx.insert(productos).values(valores).returning();
      if (!p) throw new Error("No existe el producto");
      await registrarActividad(tx, { usuarioId, accion: d.id ? "producto.editar" : "producto.crear", entidad: "productos", entidadId: p.id, despues: valores });
      return p.id;
    });
    return { ok: true, valor: id };
  } catch (err) {
    if (String((err as { cause?: unknown }).cause ?? err).includes("productos_nombre_unique")) return error("Ya hay un producto con ese nombre.");
    throw err;
  }
}

/**
 * Recuento: se cuenta lo que hay de verdad y se anota la diferencia (nunca se cambia el historial).
 * También sirve para la primera carga de existencias.
 */
export async function contarExistencias(db: BaseDatos, usuarioId: string, productoId: string, contado: number, motivo: string): Promise<Resultado<number>> {
  if (!Number.isInteger(contado) || contado < 0) return error("Revisa la cantidad contada.");
  return db.transaction(async (tx) => {
    // Un recuento a la vez por producto, para que la diferencia sea la buena.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`stock:${productoId}`}))`);
    const diferencia = contado - (await stockDeProducto(tx, productoId));
    if (diferencia !== 0) {
      await tx.insert(movimientosStock).values({ productoId, tipo: "ajuste", cantidad: diferencia, motivo: motivo.trim() || "Recuento", usuarioId });
      await registrarActividad(tx, { usuarioId, accion: "stock.recuento", entidad: "productos", entidadId: productoId, despues: { contado, diferencia } });
    }
    return { ok: true as const, valor: diferencia };
  });
}

/** Unidades rotas, caducadas o gastadas fuera de un tratamiento. */
export async function anotarMerma(db: BaseDatos, usuarioId: string, productoId: string, cantidad: number, motivo: string): Promise<Resultado<null>> {
  if (!Number.isInteger(cantidad) || cantidad <= 0) return error("Revisa la cantidad.");
  if (!motivo.trim()) return error("Escribe el motivo.");
  await db.transaction(async (tx) => {
    await tx.insert(movimientosStock).values({ productoId, tipo: "merma", cantidad: -cantidad, motivo: motivo.trim(), usuarioId });
    await registrarActividad(tx, { usuarioId, accion: "stock.merma", entidad: "productos", entidadId: productoId, despues: { cantidad, motivo: motivo.trim() } });
  });
  return { ok: true, valor: null };
}

/** Lo que se gasta de un producto en un tratamiento (0 = nada). */
export async function fijarConsumo(db: BaseDatos, usuarioId: string, productoId: string, tratamientoId: string, cantidad: number): Promise<Resultado<null>> {
  if (!Number.isInteger(cantidad) || cantidad < 0) return error("Revisa la cantidad.");
  await db.transaction(async (tx) => {
    await tx.delete(consumosTratamiento).where(and(eq(consumosTratamiento.productoId, productoId), eq(consumosTratamiento.tratamientoId, tratamientoId)));
    if (cantidad > 0) await tx.insert(consumosTratamiento).values({ productoId, tratamientoId, cantidad });
    await registrarActividad(tx, { usuarioId, accion: "stock.consumo", entidad: "productos", entidadId: productoId, despues: { tratamientoId, cantidad } });
  });
  return { ok: true, valor: null };
}

/**
 * Salidas de stock de un cobro (dentro de su transacción): productos vendidos y lo que se gasta en cabina en cada
 * tratamiento hecho (cobrado o pagado con bono).
 */
export async function salidasDeCobro(
  tx: Tx,
  d: { usuarioId: string; ventaId: string | null; citaId: string | null; productos: { productoId: string; cantidad: number }[]; tratamientos: string[] },
) {
  for (const p of d.productos) {
    await tx.insert(movimientosStock).values({ productoId: p.productoId, tipo: "venta", cantidad: -p.cantidad, ventaId: d.ventaId, citaId: d.citaId, usuarioId: d.usuarioId });
  }
  if (d.tratamientos.length === 0) return;
  const consumos = await tx.select().from(consumosTratamiento).where(inArray(consumosTratamiento.tratamientoId, [...new Set(d.tratamientos)]));
  const total = new Map<string, number>();
  for (const t of d.tratamientos) {
    for (const c of consumos.filter((x) => x.tratamientoId === t)) total.set(c.productoId, (total.get(c.productoId) ?? 0) + c.cantidad);
  }
  for (const [productoId, cantidad] of total) {
    await tx.insert(movimientosStock).values({ productoId, tipo: "consumo", cantidad: -cantidad, ventaId: d.ventaId, citaId: d.citaId, usuarioId: d.usuarioId });
  }
}

// ── Proveedores ──────────────────────────────────────────────────────────────

export interface DatosProveedor {
  id?: string;
  nombre: string;
  nif?: string;
  telefono?: string;
  email?: string;
  notas?: string;
}

export async function guardarProveedor(db: BaseDatos, usuarioId: string, d: DatosProveedor): Promise<Resultado<string>> {
  const nombre = d.nombre.trim();
  if (nombre.length < 2 || nombre.length > 80) return error("Escribe el nombre del proveedor.");
  const valores = { nombre, nif: textoONull(d.nif)?.toUpperCase() ?? null, telefono: textoONull(d.telefono), email: textoONull(d.email), notas: textoONull(d.notas) };
  try {
    const id = await db.transaction(async (tx) => {
      const [p] = d.id ? await tx.update(proveedores).set(valores).where(eq(proveedores.id, d.id)).returning() : await tx.insert(proveedores).values(valores).returning();
      if (!p) throw new Error("No existe el proveedor");
      await registrarActividad(tx, { usuarioId, accion: d.id ? "proveedor.editar" : "proveedor.crear", entidad: "proveedores", entidadId: p.id, despues: valores });
      return p.id;
    });
    return { ok: true, valor: id };
  } catch (err) {
    if (String((err as { cause?: unknown }).cause ?? err).includes("proveedores_nombre_unique")) return error("Ya hay un proveedor con ese nombre.");
    throw err;
  }
}

// ── Compras ──────────────────────────────────────────────────────────────────

export interface Compra {
  proveedorId: string;
  fecha: string;
  numeroFactura?: string;
  ivaCentesimas: number;
  lineas: { productoId: string; cantidad: number; costeUnitario: number }[];
  notas?: string;
}

/** Compra a un proveedor: entra en el stock, actualiza el coste de cada producto y anota su gasto. */
export async function registrarCompra(db: BaseDatos, usuarioId: string, c: Compra): Promise<Resultado<{ compraId: string; total: number }>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.fecha)) return error("Revisa la fecha.");
  if (c.lineas.length === 0) return error("Añade al menos un producto.");
  if (c.lineas.some((l) => !Number.isInteger(l.cantidad) || l.cantidad <= 0 || !Number.isInteger(l.costeUnitario) || l.costeUnitario < 0)) {
    return error("Revisa las cantidades y los costes.");
  }
  if (!Number.isInteger(c.ivaCentesimas) || c.ivaCentesimas < 0 || c.ivaCentesimas > 10_000) return error("Revisa el IVA.");
  const [prov] = await db.select().from(proveedores).where(eq(proveedores.id, c.proveedorId));
  if (!prov) return error("Elige el proveedor.");
  const { base, cuota, total } = totalCompra(c.lineas, c.ivaCentesimas);

  const r = await db.transaction(async (tx) => {
    const [compra] = await tx
      .insert(compras)
      .values({ proveedorId: c.proveedorId, fecha: c.fecha, numeroFactura: textoONull(c.numeroFactura), notas: textoONull(c.notas), usuarioId })
      .returning();
    await tx.insert(lineasCompra).values(c.lineas.map((l, orden) => ({ compraId: compra!.id, orden, ...l })));
    for (const l of c.lineas) {
      await tx.insert(movimientosStock).values({ productoId: l.productoId, tipo: "compra", cantidad: l.cantidad, compraId: compra!.id, usuarioId });
      await tx.update(productos).set({ costeCentimos: l.costeUnitario }).where(eq(productos.id, l.productoId));
    }
    await tx.insert(gastos).values({
      fecha: c.fecha,
      categoria: "compras",
      concepto: `Compra a ${prov.nombre}`,
      proveedorId: prov.id,
      numeroFactura: textoONull(c.numeroFactura),
      base,
      ivaCentesimas: c.ivaCentesimas,
      cuota,
      total,
      compraId: compra!.id,
      usuarioId,
    });
    await registrarActividad(tx, { usuarioId, accion: "compra.registrar", entidad: "compras", entidadId: compra!.id, despues: { proveedor: prov.nombre, total, lineas: c.lineas.length } });
    return { compraId: compra!.id, total };
  });
  return { ok: true, valor: r };
}

// ── Gastos ───────────────────────────────────────────────────────────────────

export interface Gasto {
  fecha: string;
  categoria: CategoriaGasto;
  concepto: string;
  proveedorId?: string | null;
  numeroFactura?: string;
  /** Total pagado, IVA incluido. */
  total: number;
  ivaCentesimas: number;
  /** Pagado en efectivo con dinero de la caja (sale del cajón). */
  pagoCaja?: boolean;
}

export async function registrarGasto(db: BaseDatos, usuarioId: string, g: Gasto): Promise<Resultado<string>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.fecha)) return error("Revisa la fecha.");
  if (!g.concepto.trim()) return error("Escribe el concepto.");
  if (!Number.isInteger(g.total) || g.total <= 0) return error("Revisa el importe.");
  if (!Number.isInteger(g.ivaCentesimas) || g.ivaCentesimas < 0 || g.ivaCentesimas > 10_000) return error("Revisa el IVA.");
  const caja = g.pagoCaja ? await cajaAbierta(db) : null;
  if (g.pagoCaja && !caja) return error("Para pagarlo con dinero de la caja, primero abre la caja.");
  if (caja && g.total > (await resumenCaja(db, caja.id)).esperado) return error("No hay tanto efectivo en la caja.");
  const { base, cuota } = desglosarTotal(g.total, g.ivaCentesimas);
  const id = await db.transaction(async (tx) => {
    const [gasto] = await tx
      .insert(gastos)
      .values({
        fecha: g.fecha,
        categoria: g.categoria,
        concepto: g.concepto.trim(),
        proveedorId: g.proveedorId || null,
        numeroFactura: textoONull(g.numeroFactura),
        base,
        ivaCentesimas: g.ivaCentesimas,
        cuota,
        total: g.total,
        pagoCaja: Boolean(caja),
        usuarioId,
      })
      .returning();
    if (caja) await tx.insert(movimientosCaja).values({ sesionCajaId: caja.id, tipo: "salida", importe: -g.total, concepto: `Gasto: ${g.concepto.trim()}`, usuarioId });
    await registrarActividad(tx, { usuarioId, accion: "gasto.registrar", entidad: "gastos", entidadId: gasto!.id, despues: { concepto: g.concepto.trim(), total: g.total, pagoCaja: Boolean(caja) } });
    return gasto!.id;
  });
  return { ok: true, valor: id };
}

/** Un gasto anotado por error se anula (no se borra). Los de compras no: la compra ya entró en el stock. */
export async function anularGasto(db: BaseDatos, usuarioId: string, id: string): Promise<Resultado<null>> {
  const [g] = await db.select().from(gastos).where(eq(gastos.id, id));
  if (!g || g.anuladoEn) return error("Ese gasto no se puede anular.");
  if (g.compraId) return error("El gasto de una compra no se anula aquí.");
  await db.transaction(async (tx) => {
    await tx.update(gastos).set({ anuladoEn: new Date() }).where(eq(gastos.id, id));
    await registrarActividad(tx, { usuarioId, accion: "gasto.anular", entidad: "gastos", entidadId: id, antes: { concepto: g.concepto, total: g.total } });
  });
  return { ok: true, valor: null };
}

/** Hoy en Madrid (para fechas por defecto de compras y gastos). */
export const hoy = () => partesMadrid(new Date()).fecha;
