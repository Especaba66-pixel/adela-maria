import { describe, expect, it } from "vitest";
import { calcularHuella, codigoSerie, numeroFactura, validarNif, verificarCadena, type DatosHuella } from "./facturacion";
import { ABRIR_CAJON, bytesTicket, codificarPc858, lineasTicket, type DatosTicket } from "./ticket";

describe("numeración", () => {
  it("serie por tipo y año, número con ceros", () => {
    expect(codigoSerie("simplificada", 2026)).toBe("T2026");
    expect(codigoSerie("rectificativa", 2027)).toBe("R2027");
    expect(numeroFactura("T2026", 123)).toBe("T2026-000123");
  });
});

describe("registro encadenado", () => {
  const base: DatosHuella = {
    nifEmisor: "12345678Z",
    numero: "T2026-000001",
    fechaExpedicion: "2026-10-12",
    tipo: "simplificada",
    cuotaTotal: 781,
    importeTotal: 4500,
    huellaAnterior: null,
    generadoEn: "2026-10-12T10:00:00+02:00",
  };

  it("la huella es estable y cambia con cualquier dato", () => {
    const h = calcularHuella(base);
    expect(h).toMatch(/^[0-9A-F]{64}$/);
    expect(calcularHuella(base)).toBe(h);
    expect(calcularHuella({ ...base, importeTotal: 4501 })).not.toBe(h);
    expect(calcularHuella({ ...base, huellaAnterior: "X" })).not.toBe(h);
  });

  it("detecta un registro alterado o fuera de orden", () => {
    const r1 = { ...base, huella: calcularHuella(base) };
    const d2 = { ...base, numero: "T2026-000002", huellaAnterior: r1.huella };
    const r2 = { ...d2, huella: calcularHuella(d2) };
    expect(verificarCadena([r1, r2])).toBeNull();
    expect(verificarCadena([r1, { ...r2, importeTotal: 1 }])).toBe(1);
    expect(verificarCadena([r2, r1])).toBe(0);
  });
});

describe("NIF", () => {
  it("valida DNI, NIE y CIF", () => {
    expect(validarNif("12345678z")).toBe("12345678Z");
    expect(validarNif("12345678A")).toBeNull();
    expect(validarNif("X1234567L")).toBe("X1234567L");
    expect(validarNif("B12345678")).toBe("B12345678");
    expect(validarNif("hola")).toBeNull();
  });
});

describe("ticket", () => {
  const datos: DatosTicket = {
    emisor: { nombre: "Adela María · Belleza holística", nombreFiscal: "Adela María Pérez", nif: "12345678Z", direccion: "Calle Mayor 1, Alicante" },
    numero: "T2026-000001",
    fechaHora: "12/10/2026 10:35",
    tipo: "simplificada",
    lineas: [
      { descripcion: "Verse limpia y purificada (higiene facial)", cantidad: 1, total: 3000, descuentoCentesimas: 0 },
      { descripcion: "Axilas", cantidad: 2, total: 900, descuentoCentesimas: 1000 },
    ],
    desglose: [{ ivaCentesimas: 2100, base: 3223, cuota: 677 }],
    total: 3900,
    pagos: [{ metodo: "Efectivo", importe: 3900 }],
    entregado: 5000,
    cambio: 1100,
    atendidaPor: "Adela",
    pie: "¡Gracias por tu visita!",
  };

  it("cabe en el ancho del papel y lleva lo obligatorio", () => {
    for (const ancho of [32, 48]) {
      const l = lineasTicket(datos, ancho);
      for (const x of l) expect(x.length, x).toBeLessThanOrEqual(ancho);
      const texto = l.join("\n");
      expect(texto).toContain("FACTURA SIMPLIFICADA");
      expect(texto).toContain("NIF 12345678Z");
      expect(texto).toContain("T2026-000001");
      expect(texto).toContain("2 x Axilas");
      expect(texto).toContain("dto. 10 %");
      expect(texto).toMatch(/TOTAL\s+39,00 €/);
      expect(texto).toMatch(/IVA 21 %\s+6,77 €/);
      expect(texto).toMatch(/Cambio\s+11,00 €/);
    }
  });

  it("codifica tildes y euro para la impresora, corta y abre el cajón", () => {
    expect(codificarPc858("€ñá")).toEqual([0xd5, 0xa4, 0xa0]);
    const bytes = Array.from(bytesTicket(["Hola"], { abrirCajon: true }));
    expect(bytes.slice(0, 2)).toEqual([0x1b, 0x40]);
    expect(bytes.slice(-ABRIR_CAJON.length)).toEqual(ABRIR_CAJON);
    expect(Array.from(bytesTicket(["Hola"])).slice(-ABRIR_CAJON.length)).not.toEqual(ABRIR_CAJON);
  });
});
