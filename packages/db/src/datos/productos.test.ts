import { describe, expect, it } from "vitest";
import { COMPRAS_INICIALES, GRUPO_DE, MARGEN_VENTA, PRODUCTOS_VENTA } from "./productos";

const arganour = COMPRAS_INICIALES.find((c) => c.numeroFactura === "INV-ES-21420")!;

describe("primera compra (Arganour, INV-ES-21420)", () => {
  it("cuadra con la factura: 38 líneas, 43 unidades, 342,48 € − 102,60 € + 50,39 € de IVA = 290,27 €", () => {
    expect(arganour.lineas).toHaveLength(38);
    expect(arganour.lineas.reduce((s, [, cantidad]) => s + cantidad, 0)).toBe(43);
    const suma = arganour.lineas.reduce((s, [, cantidad, coste]) => s + cantidad * coste, 0);
    expect(suma).toBe(34_248);
    expect(arganour.totalFactura - (suma - arganour.descuento)).toBe(5_039);
  });

  it("todos sus productos tienen grupo en la web", () => {
    for (const [nombre] of arganour.lineas) expect(GRUPO_DE[nombre], nombre).toBeDefined();
  });
});

describe("productos de venta", () => {
  it("son 25, sin repetidos, con IVA del 21 %", () => {
    expect(PRODUCTOS_VENTA).toHaveLength(25);
    expect(new Set(PRODUCTOS_VENTA.map((p) => p.nombre)).size).toBe(25);
    for (const p of PRODUCTOS_VENTA) expect(p.ivaCentesimas).toBe(2_100);
  });

  it("el margen es del 30 % sobre el coste real como mínimo", () => {
    expect(MARGEN_VENTA).toBe(3_000);
    for (const p of PRODUCTOS_VENTA) {
      const sinIva = p.precioCentimos / 1.21;
      expect(sinIva / p.costeCentimos, p.nombre).toBeGreaterThanOrEqual(1.3);
      expect(sinIva / p.costeCentimos, p.nombre).toBeLessThan(1.34);
    }
  });

  it("el coste real ya descuenta el 30 % del pedido (ejemplo: D-Glow, 3 unidades a 11,25, 11,20 y 12,34 €)", () => {
    const dglow = PRODUCTOS_VENTA.find((p) => p.nombre.startsWith("D-Glow"))!;
    expect(dglow.costeCentimos).toBe(812);
    expect(dglow.precioCentimos).toBe(1_280);
  });
});
