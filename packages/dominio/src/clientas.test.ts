import { describe, expect, it } from "vitest";
import { telefonoDeBusqueda, validarClienta } from "./clientas";

const base = { nombre: " Marta  López ", telefono: "600 11 22 33", email: "", fechaNacimiento: "", notas: "" };

describe("ficha de clienta", () => {
  it("limpia los datos; el teléfono es opcional", () => {
    expect(validarClienta(base, "2026-10-09")).toEqual({
      ok: true,
      datos: { nombre: "Marta López", telefono: "+34600112233", email: null, fechaNacimiento: null, notas: null },
    });
    expect(validarClienta({ ...base, telefono: "" }, "2026-10-09").ok).toBe(true);
  });

  it.each([
    [{ nombre: "M" }, /nombre/],
    [{ telefono: "123" }, /teléfono/],
    [{ email: "marta@" }, /correo/],
    [{ fechaNacimiento: "2030-01-01" }, /nacimiento/],
  ])("rechaza %o", (cambio, error) => {
    const r = validarClienta({ ...base, ...cambio }, "2026-10-09");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(error);
  });

  it("busca por teléfono completo o por trozo", () => {
    expect(telefonoDeBusqueda("600 11 22 33")).toBe("+34600112233");
    expect(telefonoDeBusqueda("1122")).toBe("1122");
    expect(telefonoDeBusqueda("Marta")).toBeNull();
  });
});
