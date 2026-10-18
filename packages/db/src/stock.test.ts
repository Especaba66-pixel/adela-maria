import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { categorias, centro, cobros, gastos, movimientosStock, sembrar, stock, tratamientos, usuarios, type BaseDatos } from "./index";
import { baseDePruebas } from "./pruebas/preparar";

let db: BaseDatos;
let cerrar: () => Promise<void>;
let adela: string;
let proveedor: string;
let crema: string;
let cera: string;
let depilacion: string;

async function errorDe(consulta: Promise<unknown>): Promise<string | null> {
  try {
    await consulta;
    return null;
  } catch (e) {
    const err = e as { cause?: { message?: string }; message?: string };
    return err.cause?.message ?? err.message ?? String(e);
  }
}
const valor = <T>(r: { ok: true; valor: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.valor;
};
const lineaCrema = (cantidad = 1) => ({ descripcion: "Crema", cantidad, precioUnitario: 2500, descuentoCentesimas: 0, ivaCentesimas: 2100, productoId: crema });

beforeAll(async () => {
  ({ db, cerrar } = await baseDePruebas());
  await sembrar(db, { nombre: "Adela", usuario: "adela", contrasena: "contrasena-de-prueba", pin: "2468" }, { categorias: [], bonos: [] });
  [{ id: adela }] = (await db.select({ id: usuarios.id }).from(usuarios)) as [{ id: string }];
  await db.update(centro).set({ nombreFiscal: "Adela María Pérez", nif: "12345678Z", direccionFiscal: "Calle Mayor 1, Alicante" });
  const [cat] = await db.insert(categorias).values({ nombre: "Depilación" }).returning();
  [{ id: depilacion }] = (await db.insert(tratamientos).values({ categoriaId: cat!.id, nombre: "Piernas", duracionMinutos: 20, precioCentimos: 1300, ivaCentesimas: 2100 }).returning()) as unknown as [{ id: string }];
  await cobros.abrirCaja(db, adela, 10_000);
});
afterAll(async () => cerrar());

describe("productos y proveedores", () => {
  it("se dan de alta, sin nombres repetidos", async () => {
    proveedor = valor(await stock.guardarProveedor(db, adela, { nombre: "Cosmética Levante", nif: "b12345678" }));
    expect(await stock.guardarProveedor(db, adela, { nombre: "Cosmética Levante" })).toMatchObject({ ok: false, error: /Ya hay/ });
    crema = valor(await stock.guardarProducto(db, adela, { nombre: "Crema hidratante", uso: "venta", precio: 2500, iva: 2100, stockMinimo: 2, proveedorId: proveedor }));
    cera = valor(await stock.guardarProducto(db, adela, { nombre: "Cera tibia", uso: "cabina", stockMinimo: 1 }));
    expect(await stock.guardarProducto(db, adela, { nombre: "Crema hidratante", uso: "venta", stockMinimo: 0 })).toMatchObject({ ok: false, error: /Ya hay/ });
    expect(await stock.stockDeProducto(db, crema)).toBe(0);
  });
});

describe("compras", () => {
  it("una compra entra en el stock, guarda el coste y anota su gasto con el IVA", async () => {
    const r = await stock.registrarCompra(db, adela, {
      proveedorId: proveedor,
      fecha: "2026-10-13",
      numeroFactura: "F-77",
      ivaCentesimas: 2100,
      lineas: [
        { productoId: crema, cantidad: 4, costeUnitario: 1000 },
        { productoId: cera, cantidad: 3, costeUnitario: 500 },
      ],
    });
    expect(r).toMatchObject({ ok: true, valor: { total: 6655 } });
    expect(await stock.stockDeProducto(db, crema)).toBe(4);
    const [g] = await db.select().from(gastos);
    expect(g).toMatchObject({ categoria: "compras", base: 5500, cuota: 1155, total: 6655, numeroFactura: "F-77" });
    const lista = await stock.listaProductos(db);
    expect(lista.find((p) => p.id === crema)).toMatchObject({ stock: 4, costeCentimos: 1000, proveedor: "Cosmética Levante", bajo: false });
  });
});

describe("compras con descuento de pedido", () => {
  it("el gasto se anota por el total exacto de la factura y el coste del producto ya lleva el descuento", async () => {
    const serum = valor(await stock.guardarProducto(db, adela, { nombre: "Sérum de prueba", uso: "venta", precio: 1500, iva: 2100, stockMinimo: 0 }));
    const r = await stock.registrarCompra(db, adela, {
      proveedorId: proveedor,
      fecha: "2026-10-14",
      numeroFactura: "F-78",
      ivaCentesimas: 2100,
      // El mismo producto dos veces con precios distintos, como en las facturas reales.
      lineas: [
        { productoId: serum, cantidad: 1, costeUnitario: 1000 },
        { productoId: serum, cantidad: 1, costeUnitario: 1002 },
      ],
      descuento: 600,
      totalFactura: 1697,
    });
    expect(r).toMatchObject({ ok: true, valor: { total: 1697 } });
    const [g] = await db.select().from(gastos).where(eq(gastos.numeroFactura, "F-78"));
    expect(g).toMatchObject({ base: 1402, cuota: 295, total: 1697 });
    expect(await stock.stockDeProducto(db, serum)).toBe(2);
    expect((await stock.listaProductos(db)).find((p) => p.id === serum)).toMatchObject({ costeCentimos: 701 });
  });

  it("rechaza un total de factura que no cuadra, sin guardar nada", async () => {
    const antes = await db.$count(gastos);
    const r = await stock.registrarCompra(db, adela, {
      proveedorId: proveedor,
      fecha: "2026-10-14",
      ivaCentesimas: 2100,
      lineas: [{ productoId: crema, cantidad: 1, costeUnitario: 1000 }],
      totalFactura: 2000,
    });
    expect(r).toMatchObject({ ok: false, error: /no cuadra/ });
    expect(await db.$count(gastos)).toBe(antes);
  });
});

describe("ventas y consumo en cabina", () => {
  it("vender un producto lo descuenta del stock en el mismo cobro, y al llegar al mínimo avisa", async () => {
    valor(await cobros.cobrar(db, adela, { lineas: [lineaCrema(2)], pagos: [{ metodo: "tarjeta", importe: 5000 }] }));
    expect(await stock.stockDeProducto(db, crema)).toBe(2);
    expect((await stock.listaProductos(db)).find((p) => p.id === crema)?.bajo).toBe(true);
  });

  it("si el cobro falla, no se descuenta nada", async () => {
    const r = await cobros.cobrar(db, adela, { lineas: [lineaCrema()], pagos: [{ metodo: "tarjeta", importe: 99_999 }] });
    expect(r.ok).toBe(false);
    expect(await stock.stockDeProducto(db, crema)).toBe(2);
  });

  it("un tratamiento gasta su producto de cabina al cobrarlo", async () => {
    valor(await stock.fijarConsumo(db, adela, cera, depilacion, 1));
    valor(
      await cobros.cobrar(db, adela, {
        lineas: [{ descripcion: "Piernas", cantidad: 2, precioUnitario: 1300, descuentoCentesimas: 0, ivaCentesimas: 2100, tratamientoId: depilacion }],
        pagos: [{ metodo: "bizum", importe: 2600 }],
      }),
    );
    expect(await stock.stockDeProducto(db, cera)).toBe(1);
    expect((await stock.listaProductos(db)).find((p) => p.id === cera)?.bajo).toBe(true);
  });

  it("al devolver una venta, el producto vuelve al stock", async () => {
    const r = valor(await cobros.cobrar(db, adela, { lineas: [lineaCrema()], pagos: [{ metodo: "efectivo", importe: 2500 }] }));
    expect(await stock.stockDeProducto(db, crema)).toBe(1);
    valor(await cobros.devolver(db, adela, r.ventaId!, "efectivo", "No le sentó bien"));
    expect(await stock.stockDeProducto(db, crema)).toBe(2);
  });
});

describe("recuentos y mermas", () => {
  it("el recuento anota la diferencia; la merma, lo que se rompe", async () => {
    expect(await stock.contarExistencias(db, adela, crema, 5, "Inventario")).toMatchObject({ ok: true, valor: 3 });
    expect(await stock.contarExistencias(db, adela, crema, 5, "Otra vez")).toMatchObject({ ok: true, valor: 0 });
    expect(await stock.anotarMerma(db, adela, crema, 1, "")).toMatchObject({ ok: false, error: /motivo/ });
    valor(await stock.anotarMerma(db, adela, crema, 1, "Se cayó"));
    expect(await stock.stockDeProducto(db, crema)).toBe(4);
  });

  it("el historial de stock no se toca", async () => {
    expect(await errorDe(db.update(movimientosStock).set({ cantidad: 100 }).where(eq(movimientosStock.productoId, crema)))).toMatch(/solo admite añadir/);
    expect(await errorDe(db.delete(movimientosStock))).toMatch(/solo admite añadir/);
  });
});

describe("gastos", () => {
  it("se desglosa el IVA del total; si se paga con la caja, sale del cajón", async () => {
    const caja = await cobros.cajaAbierta(db);
    const antes = (await cobros.resumenCaja(db, caja!.id)).esperado;
    const id = valor(await stock.registrarGasto(db, adela, { fecha: "2026-10-13", categoria: "material", concepto: "Toallas", total: 2420, ivaCentesimas: 2100, pagoCaja: true }));
    const [g] = await db.select().from(gastos).where(eq(gastos.id, id));
    expect(g).toMatchObject({ base: 2000, cuota: 420, total: 2420, pagoCaja: true });
    expect((await cobros.resumenCaja(db, caja!.id)).esperado).toBe(antes - 2420);
    expect(await stock.registrarGasto(db, adela, { fecha: "2026-10-13", categoria: "otros", concepto: "x", total: 99_999_999, ivaCentesimas: 0, pagoCaja: true })).toMatchObject({ ok: false, error: /tanto efectivo/ });
  });

  it("un gasto se anula, no se borra; el de una compra no se anula", async () => {
    const id = valor(await stock.registrarGasto(db, adela, { fecha: "2026-10-01", categoria: "alquiler", concepto: "Alquiler octubre", total: 50000, ivaCentesimas: 2100 }));
    valor(await stock.anularGasto(db, adela, id));
    expect(await stock.anularGasto(db, adela, id)).toMatchObject({ ok: false });
    const [deCompra] = await db.select().from(gastos).where(eq(gastos.categoria, "compras"));
    expect(await stock.anularGasto(db, adela, deCompra!.id)).toMatchObject({ ok: false, error: /compra/ });
    expect(await errorDe(db.delete(gastos))).toMatch(/No se borran/);
  });
});
