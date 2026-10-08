import { describe, expect, it } from "vitest";
import { eurosACentimos, formatearEuros } from "./dinero";

describe("dinero", () => {
  it("formatea céntimos en euros", () => {
    expect(formatearEuros(12000)).toBe("120,00 €");
    expect(formatearEuros(300)).toBe("3,00 €");
    expect(() => formatearEuros(1.5)).toThrow();
  });

  it("convierte texto a céntimos sin errores de coma flotante", () => {
    expect(eurosACentimos("12,50")).toBe(1250);
    expect(eurosACentimos("0.1")).toBe(10);
    expect(eurosACentimos("3")).toBe(300);
    expect(eurosACentimos("19,99 €")).toBe(1999);
    expect(eurosACentimos("1,234")).toBeNull();
    expect(eurosACentimos("-2")).toBeNull();
    expect(eurosACentimos("")).toBeNull();
  });
});
