import { calcularHuella, verificarCadena, type DatosHuella } from "@adela/dominio";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cobros, centro, facturas, movimientosCaja, pagos, registrosFacturacion, sembrar, usuarios, ventas, type BaseDatos } from "./index";
import { baseDePruebas } from "./pruebas/preparar";

let db: BaseDatos;
let cerrar: () => Promise<void>;
let adela: string;

const linea = (descripcion: string, precioUnitario: number, extra = {}) => ({
  descripcion,
  cantidad: 1,
  precioUnitario,
  descuentoCentesimas: 0,
  ivaCentesimas: 2100,
  ...extra,
});

async function errorDe(consulta: Promise<unknown>): Promise<string | null> {
  try {
    await consulta;
    return null;
  } catch (e) {
    const err = e as { cause?: { message?: string }; message?: string };
    return err.cause?.message ?? err.message ?? String(e);
  }
}

beforeAll(async () => {
  ({ db, cerrar } = await baseDePruebas());
  await sembrar(db, { nombre: "Adela", usuario: "adela", contrasena: "contrasena-de-prueba", pin: "2468" }, { categorias: [], bonos: [] });
  [{ id: adela }] = (await db.select({ id: usuarios.id }).from(usuarios)) as [{ id: string }];
});
afterAll(async () => cerrar());

describe("antes de cobrar", () => {
  it("sin datos fiscales del centro no se puede facturar", async () => {
    await cobros.abrirCaja(db, adela, 5000);
    const r = await cobros.cobrar(db, adela, { lineas: [linea("Axilas", 500)], pagos: [{ metodo: "tarjeta", importe: 500 }] });
    expect(r).toMatchObject({ ok: false, error: /datos fiscales/ });
    await db.update(centro).set({ nombreFiscal: "Adela María Pérez", nif: "12345678Z", direccionFiscal: "Calle Mayor 1, Alicante" });
  });
});

describe("cobrar", () => {
  it("cobra en efectivo con cambio: venta, pago, caja, factura y registro a la vez", async () => {
    const r = await cobros.cobrar(db, adela, {
      lineas: [linea("Verse sin manchas", 4500), linea("Axilas", 500, { cantidad: 2, descuentoCentesimas: 1000 })],
      pagos: [{ metodo: "efectivo", importe: 5400, entregado: 6000 }],
    });
    expect(r).toMatchObject({ ok: true, valor: { total: 5400, pendiente: 0, cambio: 600 } });
    if (!r.ok) return;
    expect(r.valor.numero).toMatch(/^T\d{4}-000001$/);
    const [f] = await db.select().from(facturas).where(eq(facturas.id, r.valor.facturaId!));
    expect(f).toMatchObject({ tipo: "simplificada", total: 5400, baseTotal: 4463, cuotaTotal: 937 });
    const caja = await cobros.cajaAbierta(db);
    expect((await cobros.resumenCaja(db, caja!.id)).esperado).toBe(5000 + 5400);
  });

  it("pago mixto, y a deber lo que falta", async () => {
    const r = await cobros.cobrar(db, adela, {
      lineas: [linea("Tersa y reafirmada", 4500)],
      pagos: [{ metodo: "tarjeta", importe: 2000 }, { metodo: "bizum", importe: 1000 }],
    });
    expect(r).toMatchObject({ ok: true, valor: { pendiente: 1500 } });
    if (!r.ok) return;
    expect(await cobros.pendienteDeVenta(db, r.valor.ventaId!)).toBe(1500);
    expect(await cobros.cobrarPendiente(db, adela, r.valor.ventaId!, [{ metodo: "efectivo", importe: 2000 }])).toMatchObject({ ok: false, error: /más que el total/ });
    expect(await cobros.cobrarPendiente(db, adela, r.valor.ventaId!, [{ metodo: "efectivo", importe: 1500, entregado: 2000 }])).toMatchObject({ ok: true, valor: { pendiente: 0, cambio: 500 } });
    expect(await cobros.pendienteDeVenta(db, r.valor.ventaId!)).toBe(0);
  });

  it("factura completa con datos de la clienta, en su propia serie", async () => {
    const mal = await cobros.cobrar(db, adela, { lineas: [linea("Ingles", 500)], pagos: [], destinatario: { nombre: "Marta", nif: "123", direccion: "X" } });
    expect(mal).toMatchObject({ ok: false, error: /NIF/ });
    const r = await cobros.cobrar(db, adela, {
      lineas: [linea("Ingles", 500)],
      pagos: [{ metodo: "tarjeta", importe: 500 }],
      destinatario: { nombre: "Marta López", nif: "x1234567l", direccion: "Calle Sol 2" },
    });
    expect(r).toMatchObject({ ok: true, valor: { numero: expect.stringMatching(/^F\d{4}-000001$/) } });
  });

  it("los números de cada serie van seguidos, sin saltos", async () => {
    const lista = await db.select().from(facturas).where(eq(facturas.tipo, "simplificada")).orderBy(asc(facturas.numero));
    expect(lista.map((f) => f.numero)).toEqual([1, 2]);
  });

  it("dos cobros a la vez no se pisan el número ni la cadena", async () => {
    const [a, b] = await Promise.all([
      cobros.cobrar(db, adela, { lineas: [linea("Axilas", 500)], pagos: [{ metodo: "tarjeta", importe: 500 }] }),
      cobros.cobrar(db, adela, { lineas: [linea("Brazos", 800)], pagos: [{ metodo: "tarjeta", importe: 800 }] }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    const numeros = (await db.select().from(facturas).where(eq(facturas.tipo, "simplificada"))).map((f) => f.numero).sort();
    expect(numeros).toEqual([1, 2, 3, 4]);
  });
});

describe("lo cobrado no se toca", () => {
  it("no se edita ni se borra una factura, una venta, un pago ni un movimiento de caja", async () => {
    expect(await errorDe(db.update(facturas).set({ total: 1 }))).toMatch(/solo admite añadir/);
    expect(await errorDe(db.delete(facturas))).toMatch(/solo admite añadir/);
    expect(await errorDe(db.delete(ventas))).toMatch(/solo admite añadir/);
    expect(await errorDe(db.update(pagos).set({ importe: 1 }))).toMatch(/solo admite añadir/);
    expect(await errorDe(db.delete(movimientosCaja))).toMatch(/solo admite añadir/);
    expect(await errorDe(db.delete(registrosFacturacion))).toMatch(/solo admite añadir/);
  });

  it("la cadena de registros está intacta", async () => {
    const regs = await db.select().from(registrosFacturacion).orderBy(asc(registrosFacturacion.id));
    expect(regs).toHaveLength(5);
    expect(verificarCadena(regs.map((r) => ({ ...(r.datos as DatosHuella), huella: r.huella })))).toBeNull();
    // Y la base de datos no deja colar un registro que bifurque la cadena.
    const datos = { ...(regs[1]!.datos as DatosHuella) };
    expect(await errorDe(db.insert(registrosFacturacion).values({ facturaId: regs[1]!.facturaId, tipo: "alta", huella: calcularHuella({ ...datos, numero: "falso" }), huellaAnterior: datos.huellaAnterior, datos }))).toMatch(/registros_facturacion_cadena/);
  });
});

describe("devoluciones", () => {
  it("una devolución crea una rectificativa y devuelve el efectivo; no se puede devolver dos veces", async () => {
    const [primera] = await db.select().from(facturas).where(eq(facturas.numero, 1)).limit(1);
    const caja = await cobros.cajaAbierta(db);
    const antes = (await cobros.resumenCaja(db, caja!.id)).esperado;
    expect(await cobros.devolver(db, adela, primera!.ventaId, "efectivo", "")).toMatchObject({ ok: false, error: /motivo/ });
    const r = await cobros.devolver(db, adela, primera!.ventaId, "efectivo", "No quedó contenta");
    expect(r).toMatchObject({ ok: true, valor: { numero: expect.stringMatching(/^R\d{4}-000001$/), devuelto: 5400 } });
    expect((await cobros.resumenCaja(db, caja!.id)).esperado).toBe(antes - 5400);
    const [rect] = await db.select().from(facturas).where(eq(facturas.tipo, "rectificativa"));
    expect(rect).toMatchObject({ total: -5400, rectificaA: primera!.id });
    expect(await cobros.devolver(db, adela, primera!.ventaId, "efectivo", "otra vez")).toMatchObject({ ok: false, error: /ya está devuelta/ });
  });
});

describe("caja", () => {
  it("entradas y salidas, cierre con descuadre, y sin caja abierta no se cobra", async () => {
    expect(await cobros.movimientoManual(db, adela, { tipo: "salida", importe: 1_000_000, concepto: "x" })).toMatchObject({ ok: false, error: /tanto efectivo/ });
    expect(await cobros.movimientoManual(db, adela, { tipo: "salida", importe: 1000, concepto: "Compra de algodón" })).toMatchObject({ ok: true });
    const caja = await cobros.cajaAbierta(db);
    const { esperado } = await cobros.resumenCaja(db, caja!.id);
    const r = await cobros.cerrarCaja(db, adela, esperado - 200, "Faltan 2 €");
    expect(r).toMatchObject({ ok: true, valor: { diferencia: -200 } });
    expect(await cobros.cajaAbierta(db)).toBeNull();
    expect(await cobros.cobrar(db, adela, { lineas: [linea("Axilas", 500)], pagos: [] })).toMatchObject({ ok: false, error: /abre la caja/ });
    expect(await abrirDosVeces()).toBe("La caja ya está abierta.");
  });
});

async function abrirDosVeces() {
  await cobros.abrirCaja(db, adela, 0);
  const r = await cobros.abrirCaja(db, adela, 0);
  return r.ok ? null : r.error;
}
