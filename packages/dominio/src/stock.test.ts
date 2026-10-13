import { describe, expect, it } from "vitest";
import { aCsv, desglosarTotal, stockBajo, stockDe, totalCompra, trimestre, validarProducto } from "./stock";

describe("stock", () => {
  it("el stock es la suma de movimientos y avisa al llegar al mínimo", () => {
    expect(stockDe([{ cantidad: 10 }, { cantidad: -3 }, { cantidad: -1 }])).toBe(6);
    expect(stockBajo(3, 3)).toBe(true);
    expect(stockBajo(4, 3)).toBe(false);
    expect(stockBajo(-1, 0)).toBe(false); // sin mínimo, no avisa
  });

  it("valida los productos", () => {
    const ok = { nombre: "Crema hidratante", uso: "venta", precio: 2500, iva: 2100, stockMinimo: 2 };
    expect(validarProducto(ok)).toBeNull();
    expect(validarProducto({ ...ok, nombre: "x" })).toMatch(/nombre/);
    expect(validarProducto({ ...ok, uso: "otro" })).toMatch(/vender o para cabina/);
    expect(validarProducto({ ...ok, iva: null })).toMatch(/IVA/);
    expect(validarProducto({ ...ok, stockMinimo: -1 })).toMatch(/mínimo/);
    expect(validarProducto({ nombre: "Cera", uso: "cabina", stockMinimo: 1 })).toBeNull();
  });
});

describe("compras y gastos", () => {
  it("desglosa el IVA de un total sin que se pierda un céntimo", () => {
    expect(desglosarTotal(12100, 2100)).toEqual({ base: 10000, cuota: 2100, total: 12100 });
    const d = desglosarTotal(999, 2100);
    expect(d.base + d.cuota).toBe(999);
    expect(desglosarTotal(5000, 0)).toEqual({ base: 5000, cuota: 0, total: 5000 });
  });

  it("suma una compra", () => {
    expect(totalCompra([{ cantidad: 3, costeUnitario: 1000 }, { cantidad: 2, costeUnitario: 250 }], 2100)).toEqual({ base: 3500, cuota: 735, total: 4235 });
  });

  it("trimestres naturales", () => {
    expect(trimestre("2026-10-13")).toEqual({ nombre: "2026-T4", desde: "2026-10-01", hasta: "2026-12-31" });
    expect(trimestre("2028-02-29")).toEqual({ nombre: "2028-T1", desde: "2028-01-01", hasta: "2028-03-31" });
    expect(trimestre("2026-06-30").hasta).toBe("2026-06-30");
  });

  it("CSV para Excel en español", () => {
    const csv = aCsv([["Concepto", "Importe"], ['Luz "octubre"; local', 121.5], ["Vacío", null]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Luz ""octubre""; local";121,50\r\n');
    expect(csv).toContain("Vacío;\r\n");
  });
});
