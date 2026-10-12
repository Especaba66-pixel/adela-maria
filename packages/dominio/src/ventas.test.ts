import { describe, expect, it } from "vitest";
import {
  calcularLinea,
  cambio,
  desglosarIva,
  efectivoEsperado,
  pendiente,
  sumarRecuento,
  textoPorcentaje,
  totalDe,
  validarLinea,
  validarPagos,
} from "./ventas";

const linea = (precio: number, extra: Partial<Parameters<typeof calcularLinea>[0]> = {}) =>
  calcularLinea({ descripcion: "X", cantidad: 1, precioUnitario: precio, descuentoCentesimas: 0, ivaCentesimas: 2100, ...extra });

describe("líneas", () => {
  it("cantidad y descuento", () => {
    expect(linea(4500).total).toBe(4500);
    expect(linea(300, { cantidad: 2 }).total).toBe(600);
    expect(linea(4500, { descuentoCentesimas: 1000 }).total).toBe(4050);
    expect(linea(333, { descuentoCentesimas: 1500 }).total).toBe(283); // 333 − 49,95 → 50
    expect(linea(4500, { descuentoCentesimas: 10_000 }).total).toBe(0);
  });

  it("valida", () => {
    expect(validarLinea({ descripcion: "A", cantidad: 1, precioUnitario: 100, descuentoCentesimas: 0, ivaCentesimas: 2100 })).toBeNull();
    expect(validarLinea({ descripcion: "", cantidad: 1, precioUnitario: 100, descuentoCentesimas: 0, ivaCentesimas: 2100 })).not.toBeNull();
    expect(validarLinea({ descripcion: "A", cantidad: 0, precioUnitario: 100, descuentoCentesimas: 0, ivaCentesimas: 2100 })).not.toBeNull();
    expect(validarLinea({ descripcion: "A", cantidad: 1, precioUnitario: 100, descuentoCentesimas: 12_000, ivaCentesimas: 2100 })).not.toBeNull();
  });
});

describe("IVA", () => {
  it("separa base y cuota del precio con IVA, y siempre cuadra", () => {
    expect(desglosarIva([linea(4500)])).toEqual([{ ivaCentesimas: 2100, base: 3719, cuota: 781, total: 4500 }]);
    const varias = [linea(300), linea(500), linea(700), linea(1300)];
    const [d] = desglosarIva(varias);
    expect(d!.base + d!.cuota).toBe(totalDe(varias));
    expect(d!.total).toBe(2800);
  });

  it("agrupa por tipo de IVA", () => {
    const d = desglosarIva([linea(1210), linea(1100, { ivaCentesimas: 1000 }), linea(1000)]);
    expect(d.map((x) => [x.ivaCentesimas, x.base, x.cuota])).toEqual([
      [2100, 1826, 384],
      [1000, 1000, 100],
    ]);
  });

  it("porcentaje en texto", () => {
    expect(textoPorcentaje(2100)).toBe("21 %");
    expect(textoPorcentaje(1050)).toBe("10,5 %");
  });
});

describe("pagos", () => {
  it("pago mixto y pendiente", () => {
    expect(pendiente(4500, [{ importe: 2000 }, { importe: 2500 }])).toBe(0);
    expect(pendiente(4500, [{ importe: 2000 }])).toBe(2500);
  });

  it("no se paga de más con tarjeta; en efectivo se entrega de más y se da cambio", () => {
    expect(validarPagos(4500, [{ metodo: "tarjeta", importe: 4500 }])).toBeNull();
    expect(validarPagos(4500, [{ metodo: "tarjeta", importe: 5000 }])).toMatch(/más que el total/);
    expect(validarPagos(4500, [{ metodo: "efectivo", importe: 4500, entregado: 5000 }])).toBeNull();
    expect(validarPagos(4500, [{ metodo: "efectivo", importe: 4500, entregado: 4000 }])).toMatch(/no llega/);
    expect(validarPagos(4500, [{ metodo: "bizum", importe: 0 }])).toMatch(/mayor que cero/);
    expect(validarPagos(4500, [{ metodo: "tarjeta", importe: 2000 }, { metodo: "efectivo", importe: 2500, entregado: 3000 }])).toBeNull();
    expect(cambio(4500, 5000)).toBe(500);
    expect(cambio(4500, 4500)).toBe(0);
  });
});

describe("caja", () => {
  it("efectivo esperado y recuento", () => {
    expect(efectivoEsperado([{ importe: 10_000 }, { importe: 4500 }, { importe: -2000 }])).toBe(12_500);
    expect(sumarRecuento({ 5000: 2, 100: 3, 50: 1 })).toBe(10_350);
  });
});
