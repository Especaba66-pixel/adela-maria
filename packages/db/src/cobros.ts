/**
 * Cobros, caja y facturación. Cada operación es «todo o nada»: venta, pagos, movimiento de caja, factura,
 * número y registro encadenado se guardan juntos o no se guarda nada.
 */
import {
  calcularHuella,
  calcularLinea,
  cambio,
  codigoSerie,
  desglosarIva,
  efectivoEsperado,
  numeroFactura,
  partesMadrid,
  pendiente,
  totalDe,
  validarLinea,
  validarNif,
  validarPagos,
  type DatosHuella,
  type LineaEntrada,
  type MetodoPago,
  type TipoFactura,
} from "@adela/dominio";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { registrarActividad } from "./actividad";
import {
  centro,
  citas,
  facturas,
  lineasVenta,
  movimientosCaja,
  pagos,
  registrosFacturacion,
  seriesFacturacion,
  sesionesCaja,
  ventas,
} from "./esquema";
import type { BaseDatos, Tx } from "./index";

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };
const error = (e: string) => ({ ok: false as const, error: e });

export interface Emisor {
  nombre: string;
  nombreFiscal: string;
  nif: string;
  direccion: string;
}

/** Datos fiscales del centro. Sin ellos no se puede emitir una factura. */
export async function emisor(db: BaseDatos | Tx): Promise<Resultado<Emisor>> {
  const [c] = await db.select().from(centro).limit(1);
  if (!c?.nif || !c.nombreFiscal || !c.direccionFiscal) {
    return error("Faltan los datos fiscales del centro (nombre fiscal, NIF y dirección). Ponlos en Configuración → Datos del centro.");
  }
  return { ok: true, valor: { nombre: c.nombre, nombreFiscal: c.nombreFiscal, nif: c.nif, direccion: c.direccionFiscal } };
}

// ── Caja ─────────────────────────────────────────────────────────────────────

export async function cajaAbierta(db: BaseDatos | Tx) {
  const [s] = await db.select().from(sesionesCaja).where(isNull(sesionesCaja.cerradaEn)).limit(1);
  return s ?? null;
}

export async function abrirCaja(db: BaseDatos, usuarioId: string, fondoInicial: number): Promise<Resultado<string>> {
  if (!Number.isInteger(fondoInicial) || fondoInicial < 0) return error("Revisa el fondo inicial.");
  if (await cajaAbierta(db)) return error("La caja ya está abierta.");
  try {
    const id = await db.transaction(async (tx) => {
      const [s] = await tx.insert(sesionesCaja).values({ abiertaPor: usuarioId, fondoInicial }).returning();
      if (fondoInicial > 0) await tx.insert(movimientosCaja).values({ sesionCajaId: s!.id, tipo: "fondo", importe: fondoInicial, concepto: "Fondo inicial", usuarioId });
      await registrarActividad(tx, { usuarioId, accion: "caja.abrir", entidad: "sesiones_caja", entidadId: s!.id, despues: { fondoInicial } });
      return s!.id;
    });
    return { ok: true, valor: id };
  } catch (e) {
    if (String((e as { cause?: unknown }).cause ?? e).includes("sesiones_caja_una_abierta")) return error("La caja ya está abierta.");
    throw e;
  }
}

export async function resumenCaja(db: BaseDatos | Tx, sesionId: string) {
  const movs = await db.select().from(movimientosCaja).where(eq(movimientosCaja.sesionCajaId, sesionId)).orderBy(asc(movimientosCaja.id));
  const pagosSesion = await db.select().from(pagos).where(eq(pagos.sesionCajaId, sesionId));
  const porMetodo: Record<MetodoPago, number> = { efectivo: 0, tarjeta: 0, bizum: 0 };
  for (const p of pagosSesion) porMetodo[p.metodo] += p.importe;
  const suma = (tipo: string) => movs.filter((m) => m.tipo === tipo).reduce((s, m) => s + m.importe, 0);
  return {
    movimientos: movs,
    porMetodo,
    fondo: suma("fondo"),
    entradas: suma("entrada"),
    salidas: suma("salida"),
    esperado: efectivoEsperado(movs),
  };
}

/** Entrada o salida de efectivo del cajón que no es una venta (cambio, pago a un proveedor…). */
export async function movimientoManual(
  db: BaseDatos,
  usuarioId: string,
  d: { tipo: "entrada" | "salida"; importe: number; concepto: string },
): Promise<Resultado<null>> {
  const s = await cajaAbierta(db);
  if (!s) return error("Primero abre la caja.");
  if (!Number.isInteger(d.importe) || d.importe <= 0) return error("Revisa el importe.");
  if (!d.concepto.trim()) return error("Escribe el motivo.");
  if (d.tipo === "salida" && d.importe > (await resumenCaja(db, s.id)).esperado) return error("No hay tanto efectivo en la caja.");
  await db.transaction(async (tx) => {
    await tx.insert(movimientosCaja).values({ sesionCajaId: s.id, tipo: d.tipo, importe: d.tipo === "salida" ? -d.importe : d.importe, concepto: d.concepto.trim(), usuarioId });
    await registrarActividad(tx, { usuarioId, accion: `caja.${d.tipo}`, entidad: "sesiones_caja", entidadId: s.id, despues: d });
  });
  return { ok: true, valor: null };
}

export async function cerrarCaja(db: BaseDatos, usuarioId: string, contado: number, notas: string): Promise<Resultado<{ esperado: number; contado: number; diferencia: number }>> {
  const s = await cajaAbierta(db);
  if (!s) return error("La caja no está abierta.");
  if (!Number.isInteger(contado) || contado < 0) return error("Revisa el efectivo contado.");
  const { esperado } = await resumenCaja(db, s.id);
  await db.transaction(async (tx) => {
    await tx
      .update(sesionesCaja)
      .set({ cerradaEn: new Date(), cerradaPor: usuarioId, efectivoEsperado: esperado, efectivoContado: contado, notasCierre: notas.trim() || null })
      .where(eq(sesionesCaja.id, s.id));
    await registrarActividad(tx, { usuarioId, accion: "caja.cerrar", entidad: "sesiones_caja", entidadId: s.id, despues: { esperado, contado, diferencia: contado - esperado } });
  });
  return { ok: true, valor: { esperado, contado, diferencia: contado - esperado } };
}

// ── Facturas ─────────────────────────────────────────────────────────────────

/** Emite una factura con el siguiente número de su serie y su registro encadenado. Dentro de una transacción. */
async function emitirFactura(
  tx: Tx,
  d: {
    tipo: TipoFactura;
    ventaId: string;
    emisor: Emisor;
    lineas: ReturnType<typeof calcularLinea>[];
    destinatario?: { nombre: string; nif: string; direccion: string };
    rectificaA?: string;
  },
) {
  // Una sola factura a la vez: números sin saltos y cadena de huellas sin bifurcaciones.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('adela_facturacion'))`);
  const ahora = new Date();
  const { fecha } = partesMadrid(ahora);
  const serie = codigoSerie(d.tipo, Number(fecha.slice(0, 4)));
  await tx.insert(seriesFacturacion).values({ codigo: serie, tipo: d.tipo, anio: Number(fecha.slice(0, 4)) }).onConflictDoNothing();
  const [s] = await tx
    .update(seriesFacturacion)
    .set({ ultimoNumero: sql`${seriesFacturacion.ultimoNumero} + 1` })
    .where(eq(seriesFacturacion.codigo, serie))
    .returning();
  const numero = s!.ultimoNumero;
  const numeroCompleto = numeroFactura(serie, numero);
  const desglose = desglosarIva(d.lineas);
  const total = totalDe(d.lineas);
  const cuotaTotal = desglose.reduce((x, y) => x + y.cuota, 0);
  const [f] = await tx
    .insert(facturas)
    .values({
      serie,
      numero,
      numeroCompleto,
      tipo: d.tipo,
      fechaExpedicion: fecha,
      expedidaEn: ahora,
      ventaId: d.ventaId,
      rectificaA: d.rectificaA ?? null,
      emisor: d.emisor,
      destinatario: d.destinatario ?? null,
      desglose,
      baseTotal: total - cuotaTotal,
      cuotaTotal,
      total,
    })
    .returning();

  const [ultimo] = await tx.select().from(registrosFacturacion).orderBy(desc(registrosFacturacion.id)).limit(1);
  const datos: DatosHuella = {
    nifEmisor: d.emisor.nif,
    numero: numeroCompleto,
    fechaExpedicion: fecha,
    tipo: d.tipo,
    cuotaTotal,
    importeTotal: total,
    huellaAnterior: ultimo?.huella ?? null,
    generadoEn: ahora.toISOString(),
  };
  await tx.insert(registrosFacturacion).values({ facturaId: f!.id, tipo: "alta", huella: calcularHuella(datos), huellaAnterior: datos.huellaAnterior, datos });
  return f!;
}

// ── Cobrar ───────────────────────────────────────────────────────────────────

export interface Cobro {
  clienteId?: string | null;
  citaId?: string | null;
  lineas: (LineaEntrada & { tratamientoId?: string | null })[];
  pagos: { metodo: MetodoPago; importe: number; entregado?: number }[];
  /** Si la clienta quiere factura con sus datos. */
  destinatario?: { nombre: string; nif: string; direccion: string };
}

export async function cobrar(
  db: BaseDatos,
  usuarioId: string,
  c: Cobro,
): Promise<Resultado<{ ventaId: string; facturaId: string; numero: string; total: number; pendiente: number; cambio: number }>> {
  if (c.lineas.length === 0) return error("Añade algo que cobrar.");
  for (const l of c.lineas) {
    const e = validarLinea(l);
    if (e) return error(`${l.descripcion || "Línea"}: ${e}`);
  }
  const lineas = c.lineas.map((l) => ({ ...calcularLinea(l), tratamientoId: l.tratamientoId ?? null }));
  const total = totalDe(lineas);
  const errorPagos = validarPagos(total, c.pagos);
  if (errorPagos) return error(errorPagos);

  let destinatario = c.destinatario;
  if (destinatario) {
    const nif = validarNif(destinatario.nif);
    if (!nif) return error("Revisa el NIF de la factura.");
    if (!destinatario.nombre.trim() || !destinatario.direccion.trim()) return error("Para la factura con datos hacen falta nombre, NIF y dirección.");
    destinatario = { nombre: destinatario.nombre.trim(), nif, direccion: destinatario.direccion.trim() };
  }
  const em = await emisor(db);
  if (!em.ok) return em;
  const caja = await cajaAbierta(db);
  if (!caja) return error("Primero abre la caja.");
  if (c.citaId) {
    const [cita] = await db.select().from(citas).where(eq(citas.id, c.citaId));
    if (!cita || cita.estado === "cancelada") return error("Esa cita no se puede cobrar.");
    const [yaCobrada] = await db.select({ id: ventas.id }).from(ventas).where(eq(ventas.citaId, c.citaId));
    if (yaCobrada) return error("Esa cita ya está cobrada.");
  }

  const r = await db.transaction(async (tx) => {
    const [v] = await tx
      .insert(ventas)
      .values({ clienteId: c.clienteId ?? null, citaId: c.citaId ?? null, total, creadaPor: usuarioId })
      .returning();
    await tx.insert(lineasVenta).values(
      lineas.map((l, orden) => ({
        ventaId: v!.id,
        orden,
        tratamientoId: l.tratamientoId,
        descripcion: l.descripcion.trim(),
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        descuentoCentesimas: l.descuentoCentesimas,
        ivaCentesimas: l.ivaCentesimas,
        total: l.total,
      })),
    );
    let cambioTotal = 0;
    for (const p of c.pagos) {
      const [pago] = await tx
        .insert(pagos)
        .values({ ventaId: v!.id, metodo: p.metodo, importe: p.importe, entregado: p.entregado ?? null, sesionCajaId: caja.id, usuarioId })
        .returning();
      if (p.metodo === "efectivo") {
        await tx.insert(movimientosCaja).values({ sesionCajaId: caja.id, tipo: "venta", importe: p.importe, pagoId: pago!.id, usuarioId });
        if (p.entregado !== undefined) cambioTotal += cambio(p.importe, p.entregado);
      }
    }
    // Al cobrar una cita, queda como realizada.
    if (c.citaId) await tx.update(citas).set({ estado: "realizada" }).where(and(eq(citas.id, c.citaId), eq(citas.estado, "confirmada")));
    const f = await emitirFactura(tx, { tipo: destinatario ? "completa" : "simplificada", ventaId: v!.id, emisor: em.valor, lineas, destinatario });
    await registrarActividad(tx, { usuarioId, accion: "venta.cobrar", entidad: "ventas", entidadId: v!.id, despues: { total, factura: f.numeroCompleto, pagos: c.pagos } });
    return { ventaId: v!.id, facturaId: f.id, numero: f.numeroCompleto, total, pendiente: pendiente(total, c.pagos), cambio: cambioTotal };
  });
  return { ok: true, valor: r };
}

/** Lo que queda por pagar de una venta (para las que se dejaron «a deber»). */
export async function pendienteDeVenta(db: BaseDatos | Tx, ventaId: string): Promise<number> {
  const [v] = await db.select().from(ventas).where(eq(ventas.id, ventaId));
  if (!v) return 0;
  const ps = await db.select().from(pagos).where(eq(pagos.ventaId, ventaId));
  return pendiente(v.total, ps);
}

/** Cobra lo que quedó pendiente de una venta. */
export async function cobrarPendiente(
  db: BaseDatos,
  usuarioId: string,
  ventaId: string,
  nuevos: { metodo: MetodoPago; importe: number; entregado?: number }[],
): Promise<Resultado<{ pendiente: number; cambio: number }>> {
  const falta = await pendienteDeVenta(db, ventaId);
  if (falta <= 0) return error("Esta venta ya está pagada.");
  const e = validarPagos(falta, nuevos);
  if (e) return error(e);
  const caja = await cajaAbierta(db);
  if (!caja) return error("Primero abre la caja.");
  let cambioTotal = 0;
  await db.transaction(async (tx) => {
    for (const p of nuevos) {
      const [pago] = await tx.insert(pagos).values({ ventaId, metodo: p.metodo, importe: p.importe, entregado: p.entregado ?? null, sesionCajaId: caja.id, usuarioId }).returning();
      if (p.metodo === "efectivo") {
        await tx.insert(movimientosCaja).values({ sesionCajaId: caja.id, tipo: "venta", importe: p.importe, pagoId: pago!.id, usuarioId });
        if (p.entregado !== undefined) cambioTotal += cambio(p.importe, p.entregado);
      }
    }
    await registrarActividad(tx, { usuarioId, accion: "venta.cobrar_pendiente", entidad: "ventas", entidadId: ventaId, despues: { pagos: nuevos } });
  });
  return { ok: true, valor: { pendiente: falta - nuevos.reduce((s, p) => s + p.importe, 0), cambio: cambioTotal } };
}

/**
 * Devolución completa de una venta: otra venta en negativo enlazada, factura rectificativa y devolución del dinero
 * pagado por el método elegido (en efectivo sale de la caja). Nunca se borra la venta original.
 */
export async function devolver(db: BaseDatos, usuarioId: string, ventaId: string, metodo: MetodoPago, motivo: string): Promise<Resultado<{ numero: string; devuelto: number }>> {
  if (!motivo.trim()) return error("Escribe el motivo de la devolución.");
  const [v] = await db.select().from(ventas).where(eq(ventas.id, ventaId));
  if (!v || v.devolucionDe) return error("Esta venta no se puede devolver.");
  const [yaDevuelta] = await db.select({ id: ventas.id }).from(ventas).where(eq(ventas.devolucionDe, ventaId));
  if (yaDevuelta) return error("Esta venta ya está devuelta.");
  const [original] = await db.select().from(facturas).where(eq(facturas.ventaId, ventaId));
  if (!original) return error("No se encuentra la factura de esta venta.");
  const em = await emisor(db);
  if (!em.ok) return em;
  const caja = await cajaAbierta(db);
  if (!caja) return error("Primero abre la caja.");
  const lineasOriginales = await db.select().from(lineasVenta).where(eq(lineasVenta.ventaId, ventaId)).orderBy(asc(lineasVenta.orden));
  const pagado = (await db.select().from(pagos).where(eq(pagos.ventaId, ventaId))).reduce((s, p) => s + p.importe, 0);
  if (metodo === "efectivo" && pagado > (await resumenCaja(db, caja.id)).esperado) return error("No hay tanto efectivo en la caja para devolverlo.");

  const r = await db.transaction(async (tx) => {
    const lineas = lineasOriginales.map((l) => ({ ...l, cantidad: -l.cantidad, total: -l.total }));
    const [dev] = await tx.insert(ventas).values({ clienteId: v.clienteId, devolucionDe: v.id, total: -v.total, creadaPor: usuarioId }).returning();
    await tx.insert(lineasVenta).values(lineas.map((l) => ({ ...l, ventaId: dev!.id })));
    if (pagado > 0) {
      const [p] = await tx.insert(pagos).values({ ventaId: dev!.id, metodo, importe: -pagado, sesionCajaId: caja.id, usuarioId }).returning();
      if (metodo === "efectivo") {
        await tx.insert(movimientosCaja).values({ sesionCajaId: caja.id, tipo: "devolucion", importe: -pagado, pagoId: p!.id, concepto: motivo.trim(), usuarioId });
      }
    }
    const f = await emitirFactura(tx, {
      tipo: "rectificativa",
      ventaId: dev!.id,
      emisor: em.valor,
      lineas: lineas.map((l) => ({ ...l, descripcion: l.descripcion })),
      destinatario: (original.destinatario as { nombre: string; nif: string; direccion: string } | null) ?? undefined,
      rectificaA: original.id,
    });
    await registrarActividad(tx, { usuarioId, accion: "venta.devolver", entidad: "ventas", entidadId: v.id, despues: { rectificativa: f.numeroCompleto, motivo: motivo.trim(), devuelto: pagado, metodo } });
    return { numero: f.numeroCompleto, devuelto: pagado };
  });
  return { ok: true, valor: r };
}
