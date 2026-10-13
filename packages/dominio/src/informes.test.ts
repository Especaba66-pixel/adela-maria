import { describe, expect, it } from "vitest";
import { formatearEuros } from "./dinero";
import { baseSinIva, comision, comprobarCuadre, leerPorcentaje, mesVecino, nombreMes, periodoDeMes } from "./informes";
import { MODELOS_CONSENTIMIENTO_INICIALES, rellenarConsentimiento, validarFirma, validarModeloConsentimiento } from "./fichas";

describe("informes", () => {
  it("periodos por mes, también en diciembre y febrero bisiesto", () => {
    expect(periodoDeMes("2026-10")).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" });
    expect(periodoDeMes("2026-12")).toEqual({ desde: "2026-12-01", hasta: "2026-12-31" });
    expect(periodoDeMes("2028-02")).toEqual({ desde: "2028-02-01", hasta: "2028-02-29" });
    expect(periodoDeMes("2026-13")).toBeNull();
    expect(mesVecino("2026-01", -1)).toBe("2025-12");
    expect(mesVecino("2026-12", 1)).toBe("2027-01");
    expect(nombreMes("2026-10")).toBe("octubre de 2026");
  });

  it("comisiones sobre la base sin IVA", () => {
    expect(baseSinIva(12100, 2100)).toBe(10000);
    expect(comision(10000, 1000)).toBe(1000);
    expect(comision(333, 1250)).toBe(42);
    expect(leerPorcentaje("12,5")).toBe(1250);
    expect(leerPorcentaje("")).toBe(0);
    expect(leerPorcentaje("150")).toBeNull();
  });

  it("el cuadre dice dónde no coincide", () => {
    const c = { ventas: 10000, ventasConFactura: 9000, facturas: 9000, cobrado: 9500, pendiente: 500, efectivoPagos: 3000, efectivoCaja: 2900 };
    const r = comprobarCuadre(c, formatearEuros);
    expect(r.map((x) => x.ok)).toEqual([true, true, false]);
    expect(r[2]!.detalle).toMatch(/diferencia de 1,00/);
  });
});

describe("consentimientos", () => {
  it("los modelos de partida son válidos y se rellenan", () => {
    for (const m of MODELOS_CONSENTIMIENTO_INICIALES) expect(validarModeloConsentimiento(m.nombre, m.texto)).toBeNull();
    expect(rellenarConsentimiento("Yo, {nombre}, el {fecha} en {centro}.", { nombre: "Marta", fecha: "13/10/2026", centro: "Adela María" })).toBe("Yo, Marta, el 13/10/2026 en Adela María.");
    expect(validarModeloConsentimiento("X", "corto")).toMatch(/nombre/);
    expect(validarModeloConsentimiento("Láser", `${"a".repeat(60)} {dni}`)).toMatch(/\{dni\}/);
  });

  it("la firma tiene que ser una imagen y no estar vacía", () => {
    expect(validarFirma("")).toMatch(/Falta/);
    expect(validarFirma("data:image/png;base64,AAAA")).toMatch(/Falta/);
    expect(validarFirma(`data:image/png;base64,${"A".repeat(2000)}`)).toBeNull();
    expect(validarFirma(`data:image/jpeg;base64,${"A".repeat(2000)}`)).toMatch(/Falta/);
  });
});
