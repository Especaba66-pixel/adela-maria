import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bonos,
  categorias,
  centro,
  clientes,
  cobros,
  facturas,
  movimientosTarjetaRegalo,
  sembrar,
  tarjetasRegalo,
  tiposBono,
  tiposBonoTratamientos,
  tratamientos,
  usosBono,
  usuarios,
  ventas,
  type BaseDatos,
} from "./index";
import { baseDePruebas } from "./pruebas/preparar";

let db: BaseDatos;
let cerrar: () => Promise<void>;
let adela: string;
let marta: string;
let otra: string;
let facial: string;
let labios: string;
let tipoBono: string;
let bono: string;

async function errorDe(consulta: Promise<unknown>): Promise<string | null> {
  try {
    await consulta;
    return null;
  } catch (e) {
    const err = e as { cause?: { message?: string }; message?: string };
    return err.cause?.message ?? err.message ?? String(e);
  }
}

const lineaBono = () => ({ descripcion: "Bono facial 3 sesiones", cantidad: 1, precioUnitario: 12000, descuentoCentesimas: 0, ivaCentesimas: 2100, tipoBonoId: tipoBono });
const lineaFacial = () => ({ descripcion: "Higiene facial", cantidad: 1, precioUnitario: 4500, descuentoCentesimas: 0, ivaCentesimas: 2100, tratamientoId: facial });

beforeAll(async () => {
  ({ db, cerrar } = await baseDePruebas());
  await sembrar(db, { nombre: "Adela", usuario: "adela", contrasena: "contrasena-de-prueba", pin: "2468" }, { categorias: [], bonos: [] });
  [{ id: adela }] = (await db.select({ id: usuarios.id }).from(usuarios)) as [{ id: string }];
  await db.update(centro).set({ nombreFiscal: "Adela María Pérez", nif: "12345678Z", direccionFiscal: "Calle Mayor 1, Alicante" });
  const [cat] = await db.insert(categorias).values({ nombre: "Faciales" }).returning();
  [{ id: facial }, { id: labios }] = (await db
    .insert(tratamientos)
    .values([
      { categoriaId: cat!.id, nombre: "Higiene facial", duracionMinutos: 90, precioCentimos: 4500, ivaCentesimas: 2100 },
      { categoriaId: cat!.id, nombre: "Labios", duracionMinutos: 30, precioCentimos: 3000, ivaCentesimas: 2100 },
    ])
    .returning()) as unknown as [{ id: string }, { id: string }];
  [{ id: tipoBono }] = (await db.insert(tiposBono).values({ nombre: "Bono facial 3 sesiones", sesiones: 3, precioCentimos: 12000, ivaCentesimas: 2100 }).returning()) as unknown as [{ id: string }];
  await db.insert(tiposBonoTratamientos).values({ tipoBonoId: tipoBono, tratamientoId: facial });
  [{ id: marta }, { id: otra }] = (await db.insert(clientes).values([{ nombre: "Marta López" }, { nombre: "Otra clienta" }]).returning()) as unknown as [{ id: string }, { id: string }];
  await cobros.abrirCaja(db, adela, 5000);
});
afterAll(async () => cerrar());

describe("bonos", () => {
  it("un bono se vende a nombre de una clienta y se factura al venderlo", async () => {
    expect(await cobros.cobrar(db, adela, { lineas: [lineaBono()], pagos: [{ metodo: "tarjeta", importe: 12000 }] })).toMatchObject({ ok: false, error: /Elige la clienta/ });
    const r = await cobros.cobrar(db, adela, { clienteId: marta, lineas: [lineaBono()], pagos: [{ metodo: "tarjeta", importe: 12000 }] });
    expect(r).toMatchObject({ ok: true, valor: { total: 12000, numero: expect.stringMatching(/^T/) } });
    const lista = await cobros.bonosDeCliente(db, marta);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ nombre: "Bono facial 3 sesiones", sesiones: 3, usadas: 0, caducaEn: null, tratamientoIds: [facial] });
    bono = lista[0]!.id;
  });

  it("una sesión con bono no se cobra ni se factura: solo se descuenta", async () => {
    const facturasAntes = (await db.select().from(facturas)).length;
    const r = await cobros.cobrar(db, adela, { clienteId: marta, lineas: [], pagos: [], usosBono: [{ bonoId: bono, tratamientoId: facial }] });
    expect(r).toMatchObject({ ok: true, valor: { ventaId: null, facturaId: null, total: 0, bonosUsados: [bono] } });
    expect((await db.select().from(facturas)).length).toBe(facturasAntes);
    expect((await cobros.bonosDeCliente(db, marta))[0]!.usadas).toBe(1);
  });

  it("con bono y algo más: se cobra solo lo que no cubre el bono", async () => {
    const r = await cobros.cobrar(db, adela, {
      clienteId: marta,
      lineas: [{ descripcion: "Labios", cantidad: 1, precioUnitario: 3000, descuentoCentesimas: 0, ivaCentesimas: 2100, tratamientoId: labios }],
      pagos: [{ metodo: "bizum", importe: 3000 }],
      usosBono: [{ bonoId: bono, tratamientoId: facial }],
    });
    expect(r).toMatchObject({ ok: true, valor: { total: 3000 } });
    if (!r.ok) return;
    const [uso] = await db.select().from(usosBono).where(eq(usosBono.ventaId, r.valor.ventaId!));
    expect(uso).toMatchObject({ bonoId: bono, tratamientoId: facial, cantidad: 1 });
  });

  it("el bono solo vale para sus tratamientos y para su clienta", async () => {
    expect(await cobros.cobrar(db, adela, { clienteId: marta, lineas: [], pagos: [], usosBono: [{ bonoId: bono, tratamientoId: labios }] })).toMatchObject({ ok: false, error: "Ese bono no vale para ese tratamiento." });
    expect(await cobros.cobrar(db, adela, { clienteId: otra, lineas: [], pagos: [], usosBono: [{ bonoId: bono, tratamientoId: facial }] })).toMatchObject({ ok: false, error: "Ese bono no es de esta clienta." });
  });

  it("no se gastan más sesiones de las que tiene, ni aunque se cobre dos veces a la vez", async () => {
    const uso = () => cobros.cobrar(db, adela, { clienteId: marta, lineas: [], pagos: [], usosBono: [{ bonoId: bono, tratamientoId: facial }] });
    const [a, b] = await Promise.all([uso(), uso()]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect(a.ok ? b : a).toMatchObject({ ok: false, error: "A ese bono ya no le quedan sesiones." });
    expect((await cobros.bonosDeCliente(db, marta))[0]!.usadas).toBe(3);
  });

  it("una sesión gastada por error se devuelve con su motivo, sin borrar nada", async () => {
    expect(await cobros.devolverSesion(db, adela, bono, "")).toMatchObject({ ok: false, error: /motivo/ });
    expect(await cobros.devolverSesion(db, adela, bono, "Se marcó dos veces")).toMatchObject({ ok: true });
    expect((await cobros.bonosDeCliente(db, marta))[0]!.usadas).toBe(2);
    expect((await db.select().from(usosBono).where(eq(usosBono.bonoId, bono))).length).toBe(4);
    expect(await errorDe(db.delete(usosBono))).toMatch(/solo admite añadir/);
    expect(await errorDe(db.update(bonos).set({ sesiones: 99 }))).toMatch(/solo se puede anular/);
  });

  it("un bono usado no se puede devolver; uno sin usar sí, y queda anulado", async () => {
    const [vendido] = await db.select().from(bonos).where(eq(bonos.id, bono));
    expect(await cobros.devolver(db, adela, vendido!.ventaId, "tarjeta", "Ya no lo quiere")).toMatchObject({ ok: false, error: /ya se ha usado/ });

    const r = await cobros.cobrar(db, adela, { clienteId: otra, lineas: [lineaBono()], pagos: [{ metodo: "efectivo", importe: 12000 }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await cobros.devolver(db, adela, r.valor.ventaId!, "efectivo", "Se lo pensó mejor")).toMatchObject({ ok: true, valor: { devuelto: 12000 } });
    const [nuevo] = await cobros.bonosDeCliente(db, otra);
    expect(nuevo).toMatchObject({ anulado: true });
    expect(await cobros.cobrar(db, adela, { clienteId: otra, lineas: [], pagos: [], usosBono: [{ bonoId: nuevo!.id, tratamientoId: facial }] })).toMatchObject({ ok: false, error: "Ese bono está anulado." });
  });

  it("se puede comprar el bono y hacerse la primera sesión en la misma visita", async () => {
    const [nueva] = await db.insert(clientes).values({ nombre: "Clienta nueva" }).returning();
    const r = await cobros.cobrar(db, adela, {
      clienteId: nueva!.id,
      lineas: [lineaBono()],
      pagos: [{ metodo: "tarjeta", importe: 12000 }],
      usosBono: [{ tipoBonoNuevo: tipoBono, tratamientoId: facial }],
    });
    expect(r).toMatchObject({ ok: true, valor: { total: 12000 } });
    const [b] = await cobros.bonosDeCliente(db, nueva!.id);
    expect(b).toMatchObject({ usadas: 1, sesiones: 3 });
    expect(await cobros.cobrar(db, adela, { clienteId: nueva!.id, lineas: [], pagos: [], usosBono: [{ tipoBonoNuevo: tipoBono, tratamientoId: facial }] })).toMatchObject({
      ok: false,
      error: "Ese bono no está en la cuenta.",
    });
  });

  it("un bono con caducidad no se usa pasada la fecha", async () => {
    const [vendido] = await db.select().from(bonos).where(eq(bonos.id, bono));
    const [caducado] = await db.insert(bonos).values({ tipoBonoId: tipoBono, clienteId: marta, ventaId: vendido!.ventaId, nombre: "Viejo", sesiones: 3, caducaEn: "2020-01-01" }).returning();
    expect(await errorDe(db.insert(usosBono).values({ bonoId: caducado!.id, cantidad: 1, usuarioId: adela }))).toMatch(/bono_caducado/);
  });
});

describe("tarjetas regalo", () => {
  let tarjeta: string;
  let codigo: string;

  it("se vende entera, sin factura, con un código único", async () => {
    const facturasAntes = (await db.select().from(facturas)).length;
    expect(await cobros.venderTarjetaRegalo(db, adela, { importe: 100, pagos: [{ metodo: "efectivo", importe: 100 }] })).toMatchObject({ ok: false, error: /va de/ });
    expect(await cobros.venderTarjetaRegalo(db, adela, { importe: 5000, pagos: [{ metodo: "tarjeta", importe: 2000 }] })).toMatchObject({ ok: false, error: /entera/ });
    const r = await cobros.venderTarjetaRegalo(db, adela, { importe: 5000, para: "Lucía", deParte: "Su madre", pagos: [{ metodo: "efectivo", importe: 5000, entregado: 5000 }] });
    expect(r).toMatchObject({ ok: true, valor: { codigo: expect.stringMatching(/^AM-[A-Z2-9]{4}-[A-Z2-9]{4}$/) } });
    if (!r.ok) return;
    ({ tarjetaId: tarjeta, codigo } = r.valor);
    expect((await db.select().from(facturas)).length).toBe(facturasAntes);
    const [v] = await db.select().from(ventas).innerJoin(tarjetasRegalo, eq(tarjetasRegalo.ventaId, ventas.id)).where(eq(tarjetasRegalo.id, tarjeta));
    expect(v!.ventas).toMatchObject({ conFactura: false, total: 5000 });
  });

  it("se consulta por el código como se escriba, con su saldo", async () => {
    const t = await cobros.tarjetaRegalo(db, { codigo: codigo.toLowerCase().replaceAll("-", " ") });
    expect(t).toMatchObject({ codigo, saldo: 5000, para: "Lucía", deParte: "Su madre", anulada: false });
    expect(await cobros.tarjetaRegalo(db, { codigo: "AM-0000-0000" })).toBeNull();
  });

  it("se paga con ella (y se factura entonces), sin pasar de su saldo", async () => {
    expect(
      await cobros.cobrar(db, adela, { lineas: [lineaFacial(), lineaFacial()], pagos: [{ metodo: "tarjeta_regalo", importe: 9000, tarjetaRegaloId: tarjeta }] }),
    ).toMatchObject({ ok: false, error: "La tarjeta regalo no tiene saldo suficiente." });
    const r = await cobros.cobrar(db, adela, {
      lineas: [lineaFacial(), lineaFacial()],
      pagos: [{ metodo: "tarjeta_regalo", importe: 5000, tarjetaRegaloId: tarjeta }, { metodo: "tarjeta", importe: 4000 }],
    });
    expect(r).toMatchObject({ ok: true, valor: { total: 9000, numero: expect.stringMatching(/^T/), pendiente: 0 } });
    expect(await cobros.tarjetaRegalo(db, { id: tarjeta })).toMatchObject({ saldo: 0 });
    const caja = await cobros.cajaAbierta(db);
    expect((await cobros.resumenCaja(db, caja!.id)).porMetodo.tarjeta_regalo).toBe(5000);
    expect(await errorDe(db.insert(movimientosTarjetaRegalo).values({ tarjetaId: tarjeta, tipo: "pago", importe: -1, usuarioId: adela }))).toMatch(/tarjeta_sin_saldo/);
  });

  it("si se devuelve lo pagado con ella, el saldo vuelve a la tarjeta", async () => {
    const [{ pagoId }] = (await db.select({ pagoId: movimientosTarjetaRegalo.pagoId }).from(movimientosTarjetaRegalo).where(eq(movimientosTarjetaRegalo.tipo, "pago"))) as [{ pagoId: string }];
    const { pagos } = await import("./esquema");
    const [p] = await db.select().from(pagos).where(eq(pagos.id, pagoId));
    const r = await cobros.devolver(db, adela, p!.ventaId, "tarjeta", "Error al cobrar");
    expect(r).toMatchObject({ ok: true, valor: { devuelto: 9000 } });
    expect(await cobros.tarjetaRegalo(db, { id: tarjeta })).toMatchObject({ saldo: 5000 });
  });

  it("una tarjeta usada no se devuelve; una sin estrenar sí, y queda anulada", async () => {
    const usada = await cobros.venderTarjetaRegalo(db, adela, { importe: 2000, pagos: [{ metodo: "bizum", importe: 2000 }] });
    if (!usada.ok) throw new Error(usada.error);
    await cobros.cobrar(db, adela, { lineas: [{ ...lineaFacial(), precioUnitario: 1000 }], pagos: [{ metodo: "tarjeta_regalo", importe: 1000, tarjetaRegaloId: usada.valor.tarjetaId }] });
    expect(await cobros.devolverTarjetaRegalo(db, adela, usada.valor.tarjetaId, "bizum", "No la quiere")).toMatchObject({ ok: false, error: /ya se ha usado/ });

    const nueva = await cobros.venderTarjetaRegalo(db, adela, { importe: 3000, pagos: [{ metodo: "efectivo", importe: 3000 }] });
    if (!nueva.ok) throw new Error(nueva.error);
    expect(await cobros.devolverTarjetaRegalo(db, adela, nueva.valor.tarjetaId, "efectivo", "Se equivocó de importe")).toMatchObject({ ok: true, valor: { devuelto: 3000 } });
    expect(await cobros.tarjetaRegalo(db, { id: nueva.valor.tarjetaId })).toMatchObject({ anulada: true, saldo: 0 });
    expect(
      await cobros.cobrar(db, adela, { lineas: [lineaFacial()], pagos: [{ metodo: "tarjeta_regalo", importe: 100, tarjetaRegaloId: nueva.valor.tarjetaId }] }),
    ).toMatchObject({ ok: false, error: "Esa tarjeta regalo está anulada." });
    expect(await errorDe(db.update(tarjetasRegalo).set({ importeInicial: 1 }))).toMatch(/solo se puede anular/);
  });
});
