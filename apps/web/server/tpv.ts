import "server-only";
import { categorias, centro, citasServicios, clientes, cobros, facturas, lineasVenta, pagos, tratamientos, usuarios, ventas } from "@adela/db";
import { NOMBRE_METODO, cambio, lineasTicket, type DatosTicket, type MetodoPago } from "@adela/dominio";
import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { fechaHora } from "@/lib/fechas";
import { requerirSesion } from "./auth";
import { db } from "./db";
import { citasDelDia } from "./agenda";
import { configImpresora, imprimirTicket, type ResultadoImpresion } from "./impresora";

export interface LineaCarrito {
  tratamientoId: string;
  cantidad: number;
  descuentoCentesimas: number;
}

export interface PeticionCobro {
  lineas: LineaCarrito[];
  pagos: { metodo: MetodoPago; importe: number; entregado?: number }[];
  clienteId?: string;
  citaId?: string;
  destinatario?: { nombre: string; nif: string; direccion: string };
}

/** Cobra desde el TPV: los precios e IVA salen del catálogo (nunca del navegador). Imprime y abre el cajón. */
export async function cobrarEnTpv(p: PeticionCobro) {
  const { usuario } = await requerirSesion("cobrar");
  const ids = [...new Set(p.lineas.map((l) => l.tratamientoId))];
  const lista = ids.length ? await db().select().from(tratamientos).where(inArray(tratamientos.id, ids)) : [];
  const lineas = [];
  for (const l of p.lineas) {
    const t = lista.find((x) => x.id === l.tratamientoId);
    if (!t || t.anuladoEn) return { ok: false as const, error: "Algún tratamiento ya no existe." };
    if (t.precioCentimos === null) return { ok: false as const, error: `«${t.nombre}» no tiene precio. Pónselo en Tratamientos.` };
    if (t.ivaCentesimas === null) return { ok: false as const, error: `«${t.nombre}» no tiene IVA. Pónselo en Tratamientos.` };
    lineas.push({
      tratamientoId: t.id,
      descripcion: t.nombre,
      cantidad: l.cantidad,
      precioUnitario: t.precioCentimos,
      descuentoCentesimas: l.descuentoCentesimas,
      ivaCentesimas: t.ivaCentesimas,
    });
  }
  const r = await cobros.cobrar(db(), usuario.id, { lineas, pagos: p.pagos, clienteId: p.clienteId, citaId: p.citaId, destinatario: p.destinatario });
  if (!r.ok) return r;
  const efectivo = p.pagos.some((x) => x.metodo === "efectivo");
  const impresion = await imprimirFactura(r.valor.facturaId, efectivo);
  return { ok: true as const, valor: { ...r.valor, impresion } };
}

/** Todo lo que lleva el ticket de una factura. */
export async function datosTicket(facturaId: string): Promise<DatosTicket | null> {
  const [f] = await db().select().from(facturas).where(eq(facturas.id, facturaId));
  if (!f) return null;
  const [[v], lineas, ps, [c]] = await Promise.all([
    db().select({ v: ventas, quien: usuarios.nombre }).from(ventas).innerJoin(usuarios, eq(usuarios.id, ventas.creadaPor)).where(eq(ventas.id, f.ventaId)),
    db().select().from(lineasVenta).where(eq(lineasVenta.ventaId, f.ventaId)).orderBy(asc(lineasVenta.orden)),
    db().select().from(pagos).where(eq(pagos.ventaId, f.ventaId)).orderBy(asc(pagos.cuando)),
    db().select({ pie: centro.pieTicket }).from(centro).limit(1),
  ]);
  const rectificada = f.rectificaA ? (await db().select().from(facturas).where(eq(facturas.id, f.rectificaA)))[0] : undefined;
  const efectivo = ps.find((p) => p.metodo === "efectivo" && p.entregado !== null);
  return {
    emisor: f.emisor as DatosTicket["emisor"],
    numero: f.numeroCompleto,
    fechaHora: fechaHora(f.expedidaEn).slice(0, -3),
    tipo: f.tipo,
    rectificaA: rectificada?.numeroCompleto,
    destinatario: (f.destinatario as DatosTicket["destinatario"]) ?? undefined,
    lineas: lineas.map((l) => ({ descripcion: l.descripcion, cantidad: l.cantidad, total: l.total, descuentoCentesimas: l.descuentoCentesimas })),
    desglose: f.desglose as DatosTicket["desglose"],
    total: f.total,
    pagos: ps.map((p) => ({ metodo: NOMBRE_METODO[p.metodo], importe: p.importe })),
    entregado: efectivo?.entregado ?? undefined,
    cambio: efectivo ? cambio(efectivo.importe, efectivo.entregado!) : undefined,
    atendidaPor: v!.quien,
    pie: c?.pie ?? undefined,
  };
}

export async function imprimirFactura(facturaId: string, abrirCajon: boolean): Promise<ResultadoImpresion> {
  const datos = await datosTicket(facturaId);
  if (!datos) return { ok: false, error: "No existe esa factura." };
  const { ancho = 48 } = await configImpresora();
  return imprimirTicket(lineasTicket(datos, ancho), abrirCajon);
}

/** Tratamientos que se pueden cobrar, con precio e IVA. */
export async function catalogoTpv() {
  return db()
    .select({
      id: tratamientos.id,
      nombre: tratamientos.nombre,
      categoria: categorias.nombre,
      precioCentimos: tratamientos.precioCentimos,
      ivaCentesimas: tratamientos.ivaCentesimas,
    })
    .from(tratamientos)
    .innerJoin(categorias, eq(categorias.id, tratamientos.categoriaId))
    .where(and(isNull(tratamientos.anuladoEn), isNull(categorias.anuladoEn)))
    .orderBy(asc(categorias.orden), asc(tratamientos.orden));
}

/** Citas de hoy sin cobrar (confirmadas o realizadas), con sus servicios. */
export async function citasPorCobrar(fecha: string) {
  const delDia = (await citasDelDia(fecha)).filter((c) => c.estado === "confirmada" || c.estado === "realizada");
  if (delDia.length === 0) return [];
  const cobradas = new Set(
    (await db().select({ citaId: ventas.citaId }).from(ventas).where(inArray(ventas.citaId, delDia.map((c) => c.id)))).map((v) => v.citaId),
  );
  const servicios = await db()
    .select({ citaId: citasServicios.citaId, tratamientoId: citasServicios.tratamientoId })
    .from(citasServicios)
    .where(inArray(citasServicios.citaId, delDia.map((c) => c.id)))
    .orderBy(asc(citasServicios.orden));
  return delDia
    .filter((c) => !cobradas.has(c.id))
    .map((c) => ({ ...c, tratamientoIds: servicios.filter((s) => s.citaId === c.id).map((s) => s.tratamientoId) }));
}

/** Ventas con algo pendiente de pagar («a deber»). */
export async function ventasPendientes() {
  const pagado = sql<number>`coalesce((select sum(${pagos.importe}) from ${pagos} where ${pagos.ventaId} = ${ventas.id}), 0)`;
  const filas = await db()
    .select({ id: ventas.id, total: ventas.total, pagado, creadaEn: ventas.creadaEn, cliente: clientes.nombre })
    .from(ventas)
    .leftJoin(clientes, eq(clientes.id, ventas.clienteId))
    .where(gt(ventas.total, pagado))
    .orderBy(asc(ventas.creadaEn));
  return filas.map((f) => ({ ...f, pagado: Number(f.pagado), pendiente: f.total - Number(f.pagado) }));
}
