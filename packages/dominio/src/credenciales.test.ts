import { describe, expect, it } from "vitest";
import { normalizarUsuario, validarContrasena, validarPin, validarUsuario } from "./credenciales";

describe("credenciales", () => {
  it("usuario", () => {
    expect(validarUsuario("adela")).toBeNull();
    expect(validarUsuario("maria.l")).toBeNull();
    expect(validarUsuario("ab")).not.toBeNull();
    expect(validarUsuario("María")).not.toBeNull();
    expect(normalizarUsuario("  Adela ")).toBe("adela");
  });

  it("contraseña", () => {
    expect(validarContrasena("corta")).not.toBeNull();
    expect(validarContrasena("una-contrasena-larga")).toBeNull();
  });

  it("PIN de 4 a 6 números y no trivial", () => {
    expect(validarPin("2468")).toBeNull();
    expect(validarPin("902741")).toBeNull();
    expect(validarPin("123")).not.toBeNull();
    expect(validarPin("12a4")).not.toBeNull();
    expect(validarPin("1234")).not.toBeNull();
    expect(validarPin("7777")).not.toBeNull();
    expect(validarPin("1234567")).not.toBeNull();
  });
});
