import "server-only";
import { bonos, categorias, centro, citasServicios, clientes, cobros, facturas, lineasVenta, pagos, tiposBono, tiposBonoTratamientos, tratamientos, usosBono, usuarios, ventas, type PagoEntrada, type UsoBono } from "@adela/db";
import { NOMBRE_METODO, cambio, formatearEuros, lineasTicket, lineasVale, textoQuedan, type DatosTicket, type DatosVale, type MetodoPago } from "@adela/dominio";
import { and, asc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { fechaHora } from "@/lib/fechas";
import { requerirSesion } from "./auth";
import { db } from "./db";
import { citasDelDia } from "./agenda";
import { configImpresora, imprimirTicket, type ResultadoImpresion } from "./impresora";

export type LineaCarrito =
  /**
   * Un tratamiento. Con `bonoId` se paga con una sesión de ese bono de la clienta, y con `bonoNuevo` (tipo de bono)
   * con el bono que compra en esta misma cuenta; en los dos casos no se cobra.
   */
  | { tipo: "tratamiento"; tratamientoId: string; cantidad: number; descuentoCentesimas: number; bonoId?: string; bonoNuevo?: string }
  /** Un bono que se vende. */
  | { tipo: "bono"; tipoBonoId: string; cantidad: number; descuentoCentesimas: number };

/** Pago desde el TPV: la tarjeta regalo se indica por su código. */
export type PagoTpv = { metodo: MetodoPago; importe: number; entregado?: number; codigo?: string };

export interface PeticionCobro {
  lineas: LineaCarrito[];
  pagos: PagoTpv[];
  clienteId?: string;
  citaId?: string;
  destinatario?: { nombre: string; nif: string; direccion: string };
}

type Fallo = { ok: false; error: string };

/** Convierte los códigos de tarjeta regalo en sus tarjetas. */
async function resolverPagos(ps: PagoTpv[]): Promise<{ ok: true; valor: PagoEntrada[] } | Fallo> {
  const valor: PagoEntrada[] = [];
  for (const p of ps) {
    if (p.metodo !== "tarjeta_regalo") {
      valor.push({ metodo: p.metodo, importe: p.importe, entregado: p.entregado });
      continue;
    }
    const t = p.codigo ? await cobros.tarjetaRegalo(db(), { codigo: p.codigo }) : null;
    if (!t) return { ok: false, error: "No existe ninguna tarjeta regalo con ese código." };
    valor.push({ metodo: "tarjeta_regalo", importe: p.importe, tarjetaRegaloId: t.id });
  }
  return { ok: true, valor };
}

/**
 * Cobra desde el TPV: los precios e IVA salen del catálogo (nunca del navegador). Imprime y abre el cajón.
 * Si todo se paga con bono no hay venta ni factura: se descuentan las sesiones.
 */
export async function cobrarEnTpv(p: PeticionCobro) {
  const { usuario } = await requerirSesion("cobrar");
  const ids = [...new Set(p.lineas.flatMap((l) => (l.tipo === "tratamiento" ? [l.tratamientoId] : [])))];
  const lista = ids.length ? await db().select().from(tratamientos).where(inArray(tratamientos.id, ids)) : [];
  const idsBono = [...new Set(p.lineas.flatMap((l) => (l.tipo === "bono" ? [l.tipoBonoId] : [])))];
  const tipos = idsBono.length ? await db().select().from(tiposBono).where(inArray(tiposBono.id, idsBono)) : [];
  const lineas = [];
  const usosBono: UsoBono[] = [];
  for (const l of p.lineas) {
    if (l.tipo === "bono") {
      const b = tipos.find((x) => x.id === l.tipoBonoId);
      if (!b || b.anuladoEn) return { ok: false as const, error: "Ese bono ya no está a la venta." };
      if (b.ivaCentesimas === null) return { ok: false as const, error: `«${b.nombre}» no tiene IVA. Pónselo en Tratamientos.` };
      lineas.push({ tipoBonoId: b.id, descripcion: b.nombre, cantidad: l.cantidad, precioUnitario: b.precioCentimos, descuentoCentesimas: l.descuentoCentesimas, ivaCentesimas: b.ivaCentesimas });
      continue;
    }
    if (l.bonoId || l.bonoNuevo) {
      for (let i = 0; i < l.cantidad; i++) {
        usosBono.push(l.bonoId ? { bonoId: l.bonoId, tratamientoId: l.tratamientoId } : { tipoBonoNuevo: l.bonoNuevo!, tratamientoId: l.tratamientoId });
      }
      continue;
    }
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
  const pagosResueltos = await resolverPagos(p.pagos);
  if (!pagosResueltos.ok) return pagosResueltos;
  const r = await cobros.cobrar(db(), usuario.id, { lineas, pagos: pagosResueltos.valor, usosBono, clienteId: p.clienteId, citaId: p.citaId, destinatario: p.destinatario });
  if (!r.ok) return r;
  const efectivo = p.pagos.some((x) => x.metodo === "efectivo");
  const impresion: ResultadoImpresion = r.valor.facturaId ? await imprimirFactura(r.valor.facturaId, efectivo) : { ok: true, detalle: "" };
  return { ok: true as const, valor: { ...r.valor, impresion } };
}

/** Vende una tarjeta regalo e imprime el vale. */
export async function venderTarjetaEnTpv(d: { importe: number; para?: string; deParte?: string; clienteId?: string; pagos: PagoTpv[] }) {
  const { usuario } = await requerirSesion("cobrar");
  const r = await cobros.venderTarjetaRegalo(db(), usuario.id, { ...d, pagos: d.pagos.map((p) => ({ metodo: p.metodo, importe: p.importe, entregado: p.entregado })) });
  if (!r.ok) return r;
  const impresion = await imprimirVale(r.valor.tarjetaId, d.pagos.some((x) => x.metodo === "efectivo"));
  return { ok: true as const, valor: { ...r.valor, impresion } };
}

export async function datosVale(tarjetaId: string): Promise<DatosVale | null> {
  const t = await cobros.tarjetaRegalo(db(), { id: tarjetaId });
  if (!t) return null;
  const [c] = await db().select({ nombre: centro.nombre, pie: centro.pieTicket }).from(centro).limit(1);
  return {
    centro: c?.nombre ?? "",
    codigo: t.codigo,
    importe: t.importeInicial,
    para: t.para ?? undefined,
    deParte: t.deParte ?? undefined,
    fecha: fechaHora(t.creadaEn).split(",")[0]!,
    pie: c?.pie ?? undefined,
  };
}

export async function imprimirVale(tarjetaId: string, abrirCajon: boolean): Promise<ResultadoImpresion> {
  const datos = await datosVale(tarjetaId);
  if (!datos) return { ok: false, error: "No existe esa tarjeta regalo." };
  const { ancho = 48 } = await configImpresora();
  return imprimirTicket(lineasVale(datos, ancho), abrirCajon);
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
    notas: await notasTicket(f.ventaId),
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

/** Para la clienta: sesiones que le quedan en los bonos comprados o usados y saldo de sus tarjetas regalo. */
async function notasTicket(ventaId: string): Promise<string[]> {
  const usados = await db()
    .selectDistinct({ id: bonos.id, nombre: bonos.nombre, sesiones: bonos.sesiones })
    .from(bonos)
    .leftJoin(usosBono, eq(usosBono.bonoId, bonos.id))
    .where(and(or(eq(bonos.ventaId, ventaId), eq(usosBono.ventaId, ventaId)), isNull(bonos.anuladoEn)));
  const notas: string[] = [];
  for (const b of usados) {
    const [u] = await db().select({ n: sql<number>`coalesce(sum(${usosBono.cantidad}), 0)::int` }).from(usosBono).where(eq(usosBono.bonoId, b.id));
    notas.push(`${b.nombre}: te ${textoQuedan(b.sesiones - (u?.n ?? 0))}.`);
  }
  const tarjetas = await db()
    .selectDistinct({ id: pagos.tarjetaRegaloId })
    .from(pagos)
    .where(and(eq(pagos.ventaId, ventaId), eq(pagos.metodo, "tarjeta_regalo")));
  for (const { id } of tarjetas) {
    const t = id ? await cobros.tarjetaRegalo(db(), { id }) : null;
    if (t) notas.push(`Tarjeta regalo ${t.codigo}: saldo ${formatearEuros(t.saldo)}.`);
  }
  return notas;
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

/** Bonos que se pueden vender, con lo que cubren. */
export async function bonosALaVenta() {
  const [lista, cubre] = await Promise.all([
    db()
      .select({ id: tiposBono.id, nombre: tiposBono.nombre, sesiones: tiposBono.sesiones, precioCentimos: tiposBono.precioCentimos, ivaCentesimas: tiposBono.ivaCentesimas })
      .from(tiposBono)
      .where(isNull(tiposBono.anuladoEn))
      .orderBy(asc(tiposBono.sesiones)),
    db().select().from(tiposBonoTratamientos),
  ]);
  return lista.map((b) => ({ ...b, tratamientoIds: cubre.filter((c) => c.tipoBonoId === b.id).map((c) => c.tratamientoId) }));
}

/** Citas de hoy sin cobrar (confirmadas o realizadas), con sus servicios. */
export async function citasPorCobrar(fecha: string) {
  const delDia = (await citasDelDia(fecha)).filter((c) => c.estado === "confirmada" || c.estado === "realizada");
  if (delDia.length === 0) return [];
  const ids = delDia.map((c) => c.id);
  const conBono = await db()
    .select({ citaId: usosBono.citaId })
    .from(usosBono)
    .where(inArray(usosBono.citaId, ids))
    .groupBy(usosBono.citaId)
    .having(sql`sum(${usosBono.cantidad}) > 0`);
  const cobradas = new Set([
    ...(await db().select({ citaId: ventas.citaId }).from(ventas).where(inArray(ventas.citaId, ids))).map((v) => v.citaId),
    ...conBono.map((u) => u.citaId),
  ]);
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
