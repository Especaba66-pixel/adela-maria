import { describe, expect, it } from "vitest";
import { COMPRAS_INICIALES, GASTOS_INICIALES, GRUPO_DE, PRECIO_ADELA, PRODUCTOS_VENTA, totalGastoInicial } from "./productos";

const arganour = COMPRAS_INICIALES.find((c) => c.numeroFactura === "INV-ES-21420")!;

describe("primera compra (Arganour, INV-ES-21420)", () => {
  it("cuadra con la factura: 38 líneas, 43 unidades, 342,48 € − 102,60 € + 50,39 € de IVA = 290,27 €", () => {
    expect(arganour.lineas).toHaveLength(38);
    expect(arganour.lineas.reduce((s, [, cantidad]) => s + cantidad, 0)).toBe(43);
    const suma = arganour.lineas.reduce((s, [, cantidad, coste]) => s + cantidad * coste, 0);
    expect(suma).toBe(34_248);
    expect(arganour.totalFactura! - (suma - arganour.descuento)).toBe(5_039);
  });

  it("todos sus productos tienen grupo en la web", () => {
    for (const [nombre] of arganour.lineas) expect(GRUPO_DE[nombre], nombre).toBeDefined();
  });
});

describe("compra de Área Estética (SF 26000034)", () => {
  const venta = COMPRAS_INICIALES.find((c) => c.numeroFactura === "SF 26000034")!;
  const cabina = GASTOS_INICIALES.find((g) => g.numeroFactura === "SF 26000034")!;
  const sumaVenta = venta.lineas.reduce((s, [, cantidad, coste]) => s + cantidad * coste, 0);
  const sumaCabina = cabina.lineas.reduce((s, [, , , importe]) => s + importe, 0);

  it("venta y cabina suman lo del documento: 1.281,40 € de base, 269,09 € de IVA, 1.550,49 € en total", () => {
    expect(sumaVenta + sumaCabina).toBe(128_140);
    const ivaVenta = Math.round(sumaVenta * 0.21);
    const ivaCabina = totalGastoInicial(cabina) - sumaCabina;
    expect(ivaVenta + ivaCabina).toBe(26_909);
    expect(sumaVenta + ivaVenta + totalGastoInicial(cabina)).toBe(155_049);
  });

  it("para vender: 7 productos, 23 unidades (7 de regalo)", () => {
    expect(new Set(venta.lineas.map(([n]) => n)).size).toBe(7);
    expect(venta.lineas.reduce((s, [, cantidad]) => s + cantidad, 0)).toBe(23);
    expect(venta.lineas.filter(([, , coste]) => coste === 0).reduce((s, [, cantidad]) => s + cantidad, 0)).toBe(7);
  });

  it("los regalos abaratan el coste: crema hidratante total, 3 por 49,60 €", () => {
    const crema = PRODUCTOS_VENTA.find((p) => p.nombre === "Crema hidratante total 50 ml")!;
    expect(crema).toMatchObject({ costeCentimos: 1_653, precioCentimos: 4_990, referencia: "MA030" });
  });
});

describe("productos de venta", () => {
  it("son 32, sin repetidos, con IVA del 21 %", () => {
    expect(PRODUCTOS_VENTA).toHaveLength(32);
    expect(new Set(PRODUCTOS_VENTA.map((p) => p.nombre)).size).toBe(32);
    for (const p of PRODUCTOS_VENTA) expect(p.ivaCentesimas).toBe(2_100);
  });

  it("todos llevan el precio de Adela, y ninguno se vende por debajo de lo que cuesta", () => {
    expect(Object.keys(PRECIO_ADELA).sort()).toEqual(PRODUCTOS_VENTA.map((p) => p.nombre).sort());
    for (const p of PRODUCTOS_VENTA) {
      expect(p.precioCentimos, p.nombre).toBe(PRECIO_ADELA[p.nombre]);
      expect(p.precioCentimos / 1.21, p.nombre).toBeGreaterThan(p.costeCentimos * 1.3);
    }
  });

  it("el coste real ya descuenta el 30 % del pedido (ejemplo: D-Glow, 3 unidades a 11,25, 11,20 y 12,34 €)", () => {
    const dglow = PRODUCTOS_VENTA.find((p) => p.nombre.startsWith("D-Glow"))!;
    expect(dglow.costeCentimos).toBe(812);
    expect(dglow.precioCentimos).toBe(1_600);
  });
});
