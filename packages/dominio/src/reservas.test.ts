import { describe, expect, it } from "vitest";
import {
  enlaceWhatsapp,
  formatearTelefono,
  hoyEnMadrid,
  normalizarTelefono,
  rangoFechasReserva,
  validarSolicitud,
  type DatosSolicitud,
} from "./reservas";

// 8 de octubre de 2026, 23:30 en Madrid (21:30 UTC).
const ahora = new Date("2026-10-08T21:30:00Z");
const base: DatosSolicitud = {
  tratamientoId: "t1",
  fechaPreferida: "2026-10-10",
  franja: "tarde",
  nombre: "  Marta   López ",
  telefono: "600 11 22 33",
  nota: "",
  aceptaPrivacidad: true,
};

describe("teléfono", () => {
  it.each([
    ["600112233", "+34600112233"],
    ["600 11 22 33", "+34600112233"],
    ["+34 600-11-22-33", "+34600112233"],
    ["0034600112233", "+34600112233"],
    ["34600112233", "+34600112233"],
    ["965 12 34 56", "+34965123456"],
  ])("%s → %s", (entrada, salida) => expect(normalizarTelefono(entrada)).toBe(salida));

  it.each(["", "12345", "500112233", "6001122334", "+44 7700 900123", "60011223a"])("rechaza %s", (t) =>
    expect(normalizarTelefono(t)).toBeNull(),
  );

  it("se muestra agrupado", () => expect(formatearTelefono("+34600112233")).toBe("600 11 22 33"));
});

describe("fechas en Madrid", () => {
  it("usa el día de Madrid aunque en UTC sea otro", () => {
    expect(hoyEnMadrid(new Date("2026-10-08T22:30:00Z"))).toBe("2026-10-09");
  });
  it("se puede reservar de hoy a 60 días", () => {
    expect(rangoFechasReserva(ahora)).toEqual({ desde: "2026-10-08", hasta: "2026-12-07" });
  });
});

describe("validar una petición de cita", () => {
  it("limpia los datos", () => {
    const r = validarSolicitud(base, ahora);
    expect(r).toEqual({
      ok: true,
      datos: { tratamientoId: "t1", fechaPreferida: "2026-10-10", franja: "tarde", nombre: "Marta López", telefono: "+34600112233", nota: null },
    });
  });

  it.each<[Partial<DatosSolicitud>, RegExp]>([
    [{ tratamientoId: "" }, /tratamiento/],
    [{ nombre: " a " }, /nombre/],
    [{ telefono: "123" }, /teléfono/],
    [{ fechaPreferida: "2026-10-07" }, /a partir de hoy/],
    [{ fechaPreferida: "2026-12-08" }, /60 días/],
    [{ fechaPreferida: "mañana" }, /a partir de hoy/],
    [{ franja: "noche" }, /mañana, tarde/],
    [{ nota: "x".repeat(501) }, /demasiado largo/],
    [{ aceptaPrivacidad: false }, /aceptar/],
  ])("rechaza %o", (cambio, error) => {
    const r = validarSolicitud({ ...base, ...cambio }, ahora);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(error);
  });

  it("admite el mismo día", () => expect(validarSolicitud({ ...base, fechaPreferida: "2026-10-08" }, ahora).ok).toBe(true));
});

it("enlace de WhatsApp con el mensaje escrito", () => {
  expect(enlaceWhatsapp("+34600112233", "Hola, Marta")).toBe("https://wa.me/34600112233?text=Hola%2C%20Marta");
});
