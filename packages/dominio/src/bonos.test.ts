import { describe, expect, it } from "vitest";
import { asignarBonos, caducidad, estadoBono, estadoTarjeta, generarCodigoTarjeta, normalizarCodigo, saldoTarjeta, textoQuedan, textoSesiones, validarImporteTarjeta, type Bono } from "./bonos";

const bono = (id: string, extra: Partial<Bono> = {}): Bono => ({
  id,
  sesiones: 6,
  usadas: 0,
  caducaEn: null,
  anulado: false,
  tratamientoIds: ["facial"],
  compradoEn: "2026-01-01T10:00:00Z",
  ...extra,
});

describe("bonos", () => {
  it("estado: activo, agotado, caducado o anulado", () => {
    expect(estadoBono(bono("a"), "2026-10-12")).toBe("activo");
    expect(estadoBono(bono("a", { usadas: 6 }), "2026-10-12")).toBe("agotado");
    expect(estadoBono(bono("a", { caducaEn: "2026-10-11" }), "2026-10-12")).toBe("caducado");
    expect(estadoBono(bono("a", { caducaEn: "2026-10-12" }), "2026-10-12")).toBe("activo");
    expect(estadoBono(bono("a", { anulado: true }), "2026-10-12")).toBe("anulado");
  });

  it("caducidad opcional desde el día de compra", () => {
    expect(caducidad("2026-10-12", null)).toBeNull();
    expect(caducidad("2026-10-12", 365)).toBe("2027-10-12");
    expect(caducidad("2026-03-28", 1)).toBe("2026-03-29");
  });

  it("asigna a cada tratamiento el bono que caduca antes o el más antiguo, sin pasarse de sesiones", () => {
    const viejo = bono("viejo", { usadas: 5, compradoEn: "2025-01-01T10:00:00Z" });
    const nuevo = bono("nuevo");
    expect(asignarBonos(["facial", "facial", "cejas"], [nuevo, viejo], "2026-10-12")).toEqual(["viejo", "nuevo", null]);
    const caduca = bono("caduca", { caducaEn: "2026-12-31", compradoEn: "2026-06-01T10:00:00Z" });
    expect(asignarBonos(["facial"], [nuevo, caduca], "2026-10-12")).toEqual(["caduca"]);
    expect(asignarBonos(["facial"], [bono("x", { anulado: true }), bono("y", { caducaEn: "2026-01-01" })], "2026-10-12")).toEqual([null]);
  });

  it("textos", () => {
    expect(textoSesiones(1)).toBe("1 sesión");
    expect(textoSesiones(5)).toBe("5 sesiones");
    expect(textoQuedan(1)).toBe("queda 1 sesión");
    expect(textoQuedan(0)).toBe("quedan 0 sesiones");
  });
});

describe("tarjetas regalo", () => {
  it("genera códigos legibles y distintos, sin letras que se confundan", () => {
    const codigos = new Set(Array.from({ length: 200 }, () => generarCodigoTarjeta((n) => crypto.getRandomValues(new Uint8Array(n)))));
    expect(codigos.size).toBe(200);
    for (const c of codigos) expect(c).toMatch(/^AM-[2-9A-HJKMNP-TW-Z]{4}-[2-9A-HJKMNP-TW-Z]{4}$/);
  });

  it("descarta los bytes que sesgarían el reparto", () => {
    let llamada = 0;
    const codigo = generarCodigoTarjeta((n) => (llamada++ === 0 ? new Uint8Array(n).fill(255) : new Uint8Array(n).fill(0)));
    expect(codigo).toBe("AM-2222-2222");
  });

  it("entiende el código escrito de cualquier forma", () => {
    expect(normalizarCodigo("am xk7p 3rtw")).toBe("AM-XK7P-3RTW");
    expect(normalizarCodigo("XK7P-3RTW")).toBe("AM-XK7P-3RTW");
    expect(normalizarCodigo("AM-XK7P-3RT")).toBeNull();
    expect(normalizarCodigo("AM-XK0P-3RTW")).toBeNull();
  });

  it("importe entre 5 y 1000 €, saldo y estado", () => {
    expect(validarImporteTarjeta(500)).toBeNull();
    expect(validarImporteTarjeta(499)).toMatch(/va de/);
    expect(validarImporteTarjeta(100_001)).toMatch(/va de/);
    expect(saldoTarjeta([{ importe: 5000 }, { importe: -1200 }])).toBe(3800);
    expect(estadoTarjeta({ saldo: 3800, anulada: false })).toBe("activa");
    expect(estadoTarjeta({ saldo: 0, anulada: false })).toBe("gastada");
    expect(estadoTarjeta({ saldo: 0, anulada: true })).toBe("anulada");
  });
});
