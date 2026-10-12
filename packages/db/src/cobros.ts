/**
 * Cobros, caja y facturación. Cada operación es «todo o nada»: venta, pagos, movimiento de caja, factura,
 * número y registro encadenado se guardan juntos o no se guarda nada.
 */
import { randomFillSync } from "node:crypto";
import {
  caducidad,
  calcularHuella,
  calcularLinea,
  cambio,
  codigoSerie,
  desglosarIva,
  efectivoEsperado,
  generarCodigoTarjeta,
  normalizarCodigo,
  numeroFactura,
  partesMadrid,
  pendiente,
  totalDe,
  validarLinea,
  validarNif,
  validarImporteTarjeta,
  validarPagos,
  type DatosHuella,
  type LineaEntrada,
  type MetodoPago,
  type TipoFactura,
} from "@adela/dominio";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { registrarActividad } from "./actividad";
import {
  bonos,
  bonosTratamientos,
  centro,
  citas,
  facturas,
  lineasVenta,
  movimientosCaja,
  movimientosTarjetaRegalo,
  pagos,
  registrosFacturacion,
  seriesFacturacion,
  sesionesCaja,
  tarjetasRegalo,
  tiposBono,
  tiposBonoTratamientos,
  usosBono,
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
  const porMetodo: Record<MetodoPago, number> = { efectivo: 0, tarjeta: 0, bizum: 0, tarjeta_regalo: 0 };
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

export interface PagoEntrada {
  metodo: MetodoPago;
  importe: number;
  entregado?: number;
  /** Solo para pagar con tarjeta regalo. */
  tarjetaRegaloId?: string;
}

export type UsoBono = { tratamientoId: string } & ({ bonoId: string; tipoBonoNuevo?: undefined } | { bonoId?: undefined; tipoBonoNuevo: string });

export interface Cobro {
  clienteId?: string | null;
  citaId?: string | null;
  /** Lo que se cobra: tratamientos (con `tratamientoId`) o bonos que se venden (con `tipoBonoId`). */
  lineas: (LineaEntrada & { tratamientoId?: string | null; tipoBonoId?: string | null })[];
  pagos: PagoEntrada[];
  /**
   * Tratamientos que no se cobran porque se pagan con una sesión de un bono de la clienta: uno que ya tiene
   * (`bonoId`) o uno que compra en este mismo cobro (`tipoBonoNuevo`, para hacerse hoy la primera sesión).
   */
  usosBono?: UsoBono[];
  /** Si la clienta quiere factura con sus datos. */
  destinatario?: { nombre: string; nif: string; direccion: string };
}

/** Los errores que da la propia base de datos, explicados. */
const MENSAJES_BD: Record<string, string> = {
  bono_agotado: "A ese bono ya no le quedan sesiones.",
  bono_caducado: "Ese bono está caducado.",
  bono_anulado: "Ese bono está anulado.",
  bono_no_cubre: "Ese bono no vale para ese tratamiento.",
  bono_sin_usos: "Ese bono no tiene sesiones gastadas que devolver.",
  tarjeta_sin_saldo: "La tarjeta regalo no tiene saldo suficiente.",
  tarjeta_anulada: "Esa tarjeta regalo está anulada.",
  caja_cerrada: "Primero abre la caja.",
};

function errorConocido(e: unknown): string | null {
  const texto = String((e as { cause?: unknown }).cause ?? e);
  const clave = Object.keys(MENSAJES_BD).find((k) => texto.includes(k));
  return clave ? MENSAJES_BD[clave]! : null;
}

/** Comprueba los pagos con tarjeta regalo antes de cobrar (la base de datos lo vuelve a comprobar al guardar). */
async function comprobarPagosTarjeta(db: BaseDatos, ps: PagoEntrada[]): Promise<string | null> {
  const usados = new Map<string, number>();
  for (const p of ps) {
    if (p.metodo !== "tarjeta_regalo") continue;
    if (!p.tarjetaRegaloId) return "Falta el código de la tarjeta regalo.";
    usados.set(p.tarjetaRegaloId, (usados.get(p.tarjetaRegaloId) ?? 0) + p.importe);
  }
  for (const [id, importe] of usados) {
    const t = await tarjetaRegalo(db, { id });
    if (!t) return "No existe esa tarjeta regalo.";
    if (t.anulada) return "Esa tarjeta regalo está anulada.";
    if (t.saldo < importe) return "La tarjeta regalo no tiene saldo suficiente.";
  }
  return null;
}

/** Guarda los pagos de una venta: en efectivo entran en la caja; con tarjeta regalo, salen de su saldo. Devuelve el cambio. */
async function guardarPagos(tx: Tx, ventaId: string, cajaId: string, usuarioId: string, ps: PagoEntrada[]): Promise<number> {
  let cambioTotal = 0;
  for (const p of ps) {
    const [pago] = await tx
      .insert(pagos)
      .values({
        ventaId,
        metodo: p.metodo,
        importe: p.importe,
        entregado: p.entregado ?? null,
        tarjetaRegaloId: p.metodo === "tarjeta_regalo" ? p.tarjetaRegaloId! : null,
        sesionCajaId: cajaId,
        usuarioId,
      })
      .returning();
    if (p.metodo === "efectivo") {
      await tx.insert(movimientosCaja).values({ sesionCajaId: cajaId, tipo: "venta", importe: p.importe, pagoId: pago!.id, usuarioId });
      if (p.entregado !== undefined) cambioTotal += cambio(p.importe, p.entregado);
    }
    if (p.metodo === "tarjeta_regalo") {
      await tx.insert(movimientosTarjetaRegalo).values({ tarjetaId: p.tarjetaRegaloId!, tipo: "pago", importe: -p.importe, pagoId: pago!.id, usuarioId });
    }
  }
  return cambioTotal;
}

/** Una cita ya está cobrada si tiene venta o se pagó con sesiones de bono. */
async function citaCobrada(db: BaseDatos | Tx, citaId: string): Promise<boolean> {
  const [v] = await db.select({ id: ventas.id }).from(ventas).where(eq(ventas.citaId, citaId));
  if (v) return true;
  const [u] = await db.select({ n: sql<number>`coalesce(sum(${usosBono.cantidad}), 0)::int` }).from(usosBono).where(eq(usosBono.citaId, citaId));
  return (u?.n ?? 0) > 0;
}

export interface ResultadoCobro {
  /** Vacíos si todo se pagó con bono: no hay venta ni factura. */
  ventaId: string | null;
  facturaId: string | null;
  numero: string | null;
  total: number;
  pendiente: number;
  cambio: number;
  /** Bonos usados en este cobro. */
  bonosUsados: string[];
}

export async function cobrar(db: BaseDatos, usuarioId: string, c: Cobro): Promise<Resultado<ResultadoCobro>> {
  const usos = c.usosBono ?? [];
  if (c.lineas.length === 0 && usos.length === 0) return error("Añade algo que cobrar.");
  for (const l of c.lineas) {
    const e = validarLinea(l);
    if (e) return error(`${l.descripcion || "Línea"}: ${e}`);
  }
  const lineas = c.lineas.map((l) => ({ ...calcularLinea(l), tratamientoId: l.tratamientoId ?? null, tipoBonoId: l.tipoBonoId ?? null }));
  const total = totalDe(lineas);
  const errorPagos = validarPagos(total, c.pagos);
  if (errorPagos) return error(errorPagos);
  const errorTarjeta = await comprobarPagosTarjeta(db, c.pagos);
  if (errorTarjeta) return error(errorTarjeta);

  // Bonos: se venden y se usan siempre a nombre de una clienta.
  const vendeBonos = lineas.some((l) => l.tipoBonoId);
  if ((vendeBonos || usos.length > 0) && !c.clienteId) return error("Elige la clienta: los bonos van a su nombre.");
  const tipos = vendeBonos ? await db.select().from(tiposBono).where(inArray(tiposBono.id, lineas.flatMap((l) => (l.tipoBonoId ? [l.tipoBonoId] : [])))) : [];
  for (const l of lineas) {
    if (l.tipoBonoId && !tipos.some((t) => t.id === l.tipoBonoId && !t.anuladoEn)) return error("Ese bono ya no está a la venta.");
  }
  const usosDeSusBonos = usos.flatMap((u) => (u.bonoId ? [u.bonoId] : []));
  if (usosDeSusBonos.length > 0) {
    const suyos = await db.select({ id: bonos.id }).from(bonos).where(and(inArray(bonos.id, usosDeSusBonos), eq(bonos.clienteId, c.clienteId!)));
    if (usosDeSusBonos.some((id) => !suyos.some((b) => b.id === id))) return error("Ese bono no es de esta clienta.");
  }
  if (usos.some((u) => u.tipoBonoNuevo && !lineas.some((l) => l.tipoBonoId === u.tipoBonoNuevo))) return error("Ese bono no está en la cuenta.");

  let destinatario = c.destinatario;
  if (destinatario && lineas.length > 0) {
    const nif = validarNif(destinatario.nif);
    if (!nif) return error("Revisa el NIF de la factura.");
    if (!destinatario.nombre.trim() || !destinatario.direccion.trim()) return error("Para la factura con datos hacen falta nombre, NIF y dirección.");
    destinatario = { nombre: destinatario.nombre.trim(), nif, direccion: destinatario.direccion.trim() };
  }
  const hayVenta = lineas.length > 0;
  const em = hayVenta ? await emisor(db) : null;
  if (em && !em.ok) return em;
  const caja = await cajaAbierta(db);
  if (hayVenta && !caja) return error("Primero abre la caja.");
  if (c.citaId) {
    const [cita] = await db.select().from(citas).where(eq(citas.id, c.citaId));
    if (!cita || cita.estado === "cancelada") return error("Esa cita no se puede cobrar.");
    if (await citaCobrada(db, c.citaId)) return error("Esa cita ya está cobrada.");
  }

  try {
    const r = await db.transaction(async (tx) => {
      let ventaId: string | null = null;
      let factura: { id: string; numeroCompleto: string } | null = null;
      let cambioTotal = 0;
      const nuevos = new Map<string, string[]>();
      if (hayVenta) {
        const [v] = await tx
          .insert(ventas)
          .values({ clienteId: c.clienteId ?? null, citaId: c.citaId ?? null, total, creadaPor: usuarioId })
          .returning();
        ventaId = v!.id;
        await tx.insert(lineasVenta).values(
          lineas.map((l, orden) => ({
            ventaId: v!.id,
            orden,
            tratamientoId: l.tratamientoId,
            tipoBonoId: l.tipoBonoId,
            descripcion: l.descripcion.trim(),
            cantidad: l.cantidad,
            precioUnitario: l.precioUnitario,
            descuentoCentesimas: l.descuentoCentesimas,
            ivaCentesimas: l.ivaCentesimas,
            total: l.total,
          })),
        );
        cambioTotal = await guardarPagos(tx, v!.id, caja!.id, usuarioId, c.pagos);
        // Un bono por cada unidad vendida, con los tratamientos que cubre su tipo hoy.
        const hoy = partesMadrid(new Date()).fecha;
        for (const l of lineas) {
          const tipo = tipos.find((t) => t.id === l.tipoBonoId);
          if (!tipo) continue;
          const cubiertos = await tx.select().from(tiposBonoTratamientos).where(eq(tiposBonoTratamientos.tipoBonoId, tipo.id));
          for (let i = 0; i < l.cantidad; i++) {
            const [b] = await tx
              .insert(bonos)
              .values({ tipoBonoId: tipo.id, clienteId: c.clienteId!, ventaId: v!.id, nombre: tipo.nombre, sesiones: tipo.sesiones, caducaEn: caducidad(hoy, tipo.validezDias) })
              .returning();
            if (cubiertos.length) await tx.insert(bonosTratamientos).values(cubiertos.map((x) => ({ bonoId: b!.id, tratamientoId: x.tratamientoId })));
            nuevos.set(tipo.id, [...(nuevos.get(tipo.id) ?? []), b!.id]);
          }
        }
        factura = await emitirFactura(tx, { tipo: destinatario ? "completa" : "simplificada", ventaId: v!.id, emisor: em!.valor, lineas, destinatario });
      }
      const usados: string[] = [];
      for (const u of usos) {
        const bonoId = u.bonoId ?? nuevos.get(u.tipoBonoNuevo)![0]!;
        await tx.insert(usosBono).values({ bonoId, cantidad: 1, tratamientoId: u.tratamientoId, citaId: c.citaId ?? null, ventaId, usuarioId });
        usados.push(bonoId);
      }
      // Al cobrar una cita, queda como realizada.
      if (c.citaId) await tx.update(citas).set({ estado: "realizada" }).where(and(eq(citas.id, c.citaId), eq(citas.estado, "confirmada")));
      await registrarActividad(tx, {
        usuarioId,
        accion: hayVenta ? "venta.cobrar" : "bono.usar",
        entidad: hayVenta ? "ventas" : "citas",
        entidadId: ventaId ?? c.citaId ?? undefined,
        despues: { total, factura: factura?.numeroCompleto, pagos: c.pagos, usosBono: usos },
      });
      return {
        ventaId,
        facturaId: factura?.id ?? null,
        numero: factura?.numeroCompleto ?? null,
        total,
        pendiente: pendiente(total, c.pagos),
        cambio: cambioTotal,
        bonosUsados: [...new Set(usados)],
      };
    });
    return { ok: true, valor: r };
  } catch (e) {
    const m = errorConocido(e);
    if (m) return error(m);
    throw e;
  }
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
  nuevos: PagoEntrada[],
): Promise<Resultado<{ pendiente: number; cambio: number }>> {
  if (nuevos.some((p) => p.metodo === "tarjeta_regalo")) return error("Lo pendiente se cobra en efectivo, con tarjeta o por Bizum.");
  const falta = await pendienteDeVenta(db, ventaId);
  if (falta <= 0) return error("Esta venta ya está pagada.");
  const e = validarPagos(falta, nuevos);
  if (e) return error(e);
  const caja = await cajaAbierta(db);
  if (!caja) return error("Primero abre la caja.");
  const cambioTotal = await db.transaction(async (tx) => {
    const cambioTotal = await guardarPagos(tx, ventaId, caja.id, usuarioId, nuevos);
    await registrarActividad(tx, { usuarioId, accion: "venta.cobrar_pendiente", entidad: "ventas", entidadId: ventaId, despues: { pagos: nuevos } });
    return cambioTotal;
  });
  return { ok: true, valor: { pendiente: falta - nuevos.reduce((s, p) => s + p.importe, 0), cambio: cambioTotal } };
}

/**
 * Devolución completa de una venta: otra venta en negativo enlazada, factura rectificativa y devolución del dinero.
 * Lo pagado con tarjeta regalo vuelve a su tarjeta; el resto, por el método elegido (en efectivo sale de la caja).
 * Si la venta incluía bonos, solo se puede devolver si no se han usado, y quedan anulados. Nunca se borra nada.
 */
export async function devolver(db: BaseDatos, usuarioId: string, ventaId: string, metodo: MetodoPago, motivo: string): Promise<Resultado<{ numero: string; devuelto: number }>> {
  if (!motivo.trim()) return error("Escribe el motivo de la devolución.");
  if (metodo === "tarjeta_regalo") return error("Elige cómo se devuelve el dinero.");
  const [v] = await db.select().from(ventas).where(eq(ventas.id, ventaId));
  if (!v || v.devolucionDe || !v.conFactura) return error("Esta venta no se puede devolver.");
  const [yaDevuelta] = await db.select({ id: ventas.id }).from(ventas).where(eq(ventas.devolucionDe, ventaId));
  if (yaDevuelta) return error("Esta venta ya está devuelta.");
  const [original] = await db.select().from(facturas).where(eq(facturas.ventaId, ventaId));
  if (!original) return error("No se encuentra la factura de esta venta.");
  const bonosVendidos = await db.select().from(bonos).where(eq(bonos.ventaId, ventaId));
  for (const b of bonosVendidos) {
    if ((await sesionesUsadas(db, b.id)) > 0) return error(`El bono «${b.nombre}» ya se ha usado: no se puede devolver la venta.`);
  }
  const em = await emisor(db);
  if (!em.ok) return em;
  const caja = await cajaAbierta(db);
  if (!caja) return error("Primero abre la caja.");
  const lineasOriginales = await db.select().from(lineasVenta).where(eq(lineasVenta.ventaId, ventaId)).orderBy(asc(lineasVenta.orden));
  const pagosOriginales = await db.select().from(pagos).where(eq(pagos.ventaId, ventaId));
  const conTarjeta = pagosOriginales.filter((p) => p.metodo === "tarjeta_regalo");
  const pagado = pagosOriginales.reduce((s, p) => s + p.importe, 0);
  const resto = pagado - conTarjeta.reduce((s, p) => s + p.importe, 0);
  if (metodo === "efectivo" && resto > (await resumenCaja(db, caja.id)).esperado) return error("No hay tanto efectivo en la caja para devolverlo.");

  const r = await db.transaction(async (tx) => {
    const lineas = lineasOriginales.map((l) => ({ ...l, cantidad: -l.cantidad, total: -l.total }));
    const [dev] = await tx.insert(ventas).values({ clienteId: v.clienteId, devolucionDe: v.id, total: -v.total, creadaPor: usuarioId }).returning();
    await tx.insert(lineasVenta).values(lineas.map((l) => ({ ...l, ventaId: dev!.id })));
    for (const p of conTarjeta) {
      const [pago] = await tx.insert(pagos).values({ ventaId: dev!.id, metodo: "tarjeta_regalo", importe: -p.importe, tarjetaRegaloId: p.tarjetaRegaloId, sesionCajaId: caja.id, usuarioId }).returning();
      await tx.insert(movimientosTarjetaRegalo).values({ tarjetaId: p.tarjetaRegaloId!, tipo: "devolucion", importe: p.importe, pagoId: pago!.id, usuarioId });
    }
    if (resto > 0) {
      const [p] = await tx.insert(pagos).values({ ventaId: dev!.id, metodo, importe: -resto, sesionCajaId: caja.id, usuarioId }).returning();
      if (metodo === "efectivo") {
        await tx.insert(movimientosCaja).values({ sesionCajaId: caja.id, tipo: "devolucion", importe: -resto, pagoId: p!.id, concepto: motivo.trim(), usuarioId });
      }
    }
    for (const b of bonosVendidos) {
      if (!b.anuladoEn) await tx.update(bonos).set({ anuladoEn: new Date() }).where(eq(bonos.id, b.id));
    }
    const f = await emitirFactura(tx, {
      tipo: "rectificativa",
      ventaId: dev!.id,
      emisor: em.valor,
      lineas,
      destinatario: (original.destinatario as { nombre: string; nif: string; direccion: string } | null) ?? undefined,
      rectificaA: original.id,
    });
    await registrarActividad(tx, { usuarioId, accion: "venta.devolver", entidad: "ventas", entidadId: v.id, despues: { rectificativa: f.numeroCompleto, motivo: motivo.trim(), devuelto: pagado, metodo } });
    return { numero: f.numeroCompleto, devuelto: pagado };
  });
  return { ok: true, valor: r };
}

// ── Bonos ────────────────────────────────────────────────────────────────────

async function sesionesUsadas(db: BaseDatos | Tx, bonoId: string): Promise<number> {
  const [u] = await db.select({ n: sql<number>`coalesce(sum(${usosBono.cantidad}), 0)::int` }).from(usosBono).where(eq(usosBono.bonoId, bonoId));
  return u?.n ?? 0;
}

/** Bonos de una clienta, con las sesiones gastadas y los tratamientos que cubren. Los más nuevos primero. */
export async function bonosDeCliente(db: BaseDatos | Tx, clienteId: string) {
  const lista = await db
    .select({
      id: bonos.id,
      nombre: bonos.nombre,
      sesiones: bonos.sesiones,
      compradoEn: bonos.compradoEn,
      caducaEn: bonos.caducaEn,
      anuladoEn: bonos.anuladoEn,
      ventaId: bonos.ventaId,
      usadas: sql<number>`coalesce((select sum(u.cantidad) from usos_bono u where u.bono_id = "bonos"."id"), 0)::int`,
    })
    .from(bonos)
    .where(eq(bonos.clienteId, clienteId))
    .orderBy(desc(bonos.compradoEn));
  const cubre = lista.length ? await db.select().from(bonosTratamientos).where(inArray(bonosTratamientos.bonoId, lista.map((b) => b.id))) : [];
  return lista.map((b) => ({
    ...b,
    anulado: b.anuladoEn !== null,
    compradoEn: b.compradoEn.toISOString(),
    tratamientoIds: cubre.filter((x) => x.bonoId === b.id).map((x) => x.tratamientoId),
  }));
}

/** Devuelve una sesión a un bono (se gastó por error). Queda anotado con su motivo; nunca se borra el uso. */
export async function devolverSesion(db: BaseDatos, usuarioId: string, bonoId: string, motivo: string): Promise<Resultado<null>> {
  if (!motivo.trim()) return error("Escribe el motivo.");
  try {
    await db.transaction(async (tx) => {
      await tx.insert(usosBono).values({ bonoId, cantidad: -1, motivo: motivo.trim(), usuarioId });
      await registrarActividad(tx, { usuarioId, accion: "bono.devolver_sesion", entidad: "bonos", entidadId: bonoId, despues: { motivo: motivo.trim() } });
    });
  } catch (e) {
    const m = errorConocido(e);
    if (m) return error(m);
    throw e;
  }
  return { ok: true, valor: null };
}

// ── Tarjetas regalo ──────────────────────────────────────────────────────────

/** Una tarjeta regalo por su id o por su código (como lo escriba la persona), con su saldo. */
export async function tarjetaRegalo(db: BaseDatos | Tx, por: { id: string } | { codigo: string }) {
  let filtro;
  if ("id" in por) filtro = eq(tarjetasRegalo.id, por.id);
  else {
    const codigo = normalizarCodigo(por.codigo);
    if (!codigo) return null;
    filtro = eq(tarjetasRegalo.codigo, codigo);
  }
  const [t] = await db.select().from(tarjetasRegalo).where(filtro);
  if (!t) return null;
  const movimientos = await db.select().from(movimientosTarjetaRegalo).where(eq(movimientosTarjetaRegalo.tarjetaId, t.id)).orderBy(asc(movimientosTarjetaRegalo.id));
  return { ...t, anulada: t.anuladaEn !== null, saldo: movimientos.reduce((s, m) => s + m.importe, 0), movimientos };
}

export interface VentaTarjeta {
  importe: number;
  para?: string;
  deParte?: string;
  clienteId?: string | null;
  pagos: PagoEntrada[];
}

/**
 * Vende una tarjeta regalo: se paga entera en el momento y no lleva factura (se factura lo que se pague con ella).
 * El código se genera al azar y no se repite.
 */
export async function venderTarjetaRegalo(db: BaseDatos, usuarioId: string, d: VentaTarjeta): Promise<Resultado<{ tarjetaId: string; codigo: string; cambio: number }>> {
  const e = validarImporteTarjeta(d.importe);
  if (e) return error(e);
  if (d.pagos.some((p) => p.metodo === "tarjeta_regalo")) return error("Una tarjeta regalo no se paga con otra tarjeta regalo.");
  const errorPagos = validarPagos(d.importe, d.pagos);
  if (errorPagos) return error(errorPagos);
  if (pendiente(d.importe, d.pagos) !== 0) return error("La tarjeta regalo se paga entera al venderla.");
  const caja = await cajaAbierta(db);
  if (!caja) return error("Primero abre la caja.");
  const limpiar = (t?: string) => t?.trim().slice(0, 60) || null;

  for (let intento = 0; intento < 5; intento++) {
    const codigo = generarCodigoTarjeta((n) => randomFillSync(new Uint8Array(n)));
    try {
      const r = await db.transaction(async (tx) => {
        const [v] = await tx.insert(ventas).values({ clienteId: d.clienteId ?? null, total: d.importe, conFactura: false, creadaPor: usuarioId }).returning();
        await tx.insert(lineasVenta).values({ ventaId: v!.id, orden: 0, descripcion: `Tarjeta regalo ${codigo}`, cantidad: 1, precioUnitario: d.importe, ivaCentesimas: 0, total: d.importe });
        const cambioTotal = await guardarPagos(tx, v!.id, caja.id, usuarioId, d.pagos);
        const [t] = await tx
          .insert(tarjetasRegalo)
          .values({ codigo, importeInicial: d.importe, para: limpiar(d.para), deParte: limpiar(d.deParte), clienteId: d.clienteId ?? null, ventaId: v!.id })
          .returning();
        await tx.insert(movimientosTarjetaRegalo).values({ tarjetaId: t!.id, tipo: "carga", importe: d.importe, usuarioId });
        await registrarActividad(tx, { usuarioId, accion: "tarjeta_regalo.vender", entidad: "tarjetas_regalo", entidadId: t!.id, despues: { codigo, importe: d.importe, pagos: d.pagos } });
        return { tarjetaId: t!.id, codigo, cambio: cambioTotal };
      });
      return { ok: true, valor: r };
    } catch (err) {
      if (String((err as { cause?: unknown }).cause ?? err).includes("tarjetas_regalo_codigo_unique")) continue;
      throw err;
    }
  }
  return error("No se ha podido generar el código. Prueba otra vez.");
}

/** Devuelve una tarjeta regalo sin estrenar: se devuelve el dinero y la tarjeta queda anulada. */
export async function devolverTarjetaRegalo(db: BaseDatos, usuarioId: string, tarjetaId: string, metodo: MetodoPago, motivo: string): Promise<Resultado<{ devuelto: number }>> {
  if (!motivo.trim()) return error("Escribe el motivo de la devolución.");
  if (metodo === "tarjeta_regalo") return error("Elige cómo se devuelve el dinero.");
  const t = await tarjetaRegalo(db, { id: tarjetaId });
  if (!t || t.anulada) return error("Esta tarjeta no se puede devolver.");
  if (t.saldo !== t.importeInicial) return error("La tarjeta ya se ha usado: no se puede devolver.");
  const caja = await cajaAbierta(db);
  if (!caja) return error("Primero abre la caja.");
  if (metodo === "efectivo" && t.saldo > (await resumenCaja(db, caja.id)).esperado) return error("No hay tanto efectivo en la caja para devolverlo.");
  try {
    await db.transaction(async (tx) => {
      const [v] = await tx.insert(ventas).values({ clienteId: t.clienteId, devolucionDe: t.ventaId, total: -t.importeInicial, conFactura: false, creadaPor: usuarioId }).returning();
      await tx.insert(lineasVenta).values({ ventaId: v!.id, orden: 0, descripcion: `Tarjeta regalo ${t.codigo}`, cantidad: -1, precioUnitario: t.importeInicial, ivaCentesimas: 0, total: -t.importeInicial });
      const [p] = await tx.insert(pagos).values({ ventaId: v!.id, metodo, importe: -t.saldo, sesionCajaId: caja.id, usuarioId }).returning();
      if (metodo === "efectivo") {
        await tx.insert(movimientosCaja).values({ sesionCajaId: caja.id, tipo: "devolucion", importe: -t.saldo, pagoId: p!.id, concepto: motivo.trim(), usuarioId });
      }
      await tx.insert(movimientosTarjetaRegalo).values({ tarjetaId: t.id, tipo: "anulacion", importe: -t.saldo, usuarioId });
      await tx.update(tarjetasRegalo).set({ anuladaEn: new Date() }).where(eq(tarjetasRegalo.id, t.id));
      await registrarActividad(tx, { usuarioId, accion: "tarjeta_regalo.devolver", entidad: "tarjetas_regalo", entidadId: t.id, despues: { motivo: motivo.trim(), devuelto: t.saldo, metodo } });
    });
  } catch (e) {
    if (String((e as { cause?: unknown }).cause ?? e).includes("ventas_una_devolucion")) return error("Esta tarjeta ya está devuelta.");
    throw e;
  }
  return { ok: true, valor: { devuelto: t.saldo } };
}
