import { describe, expect, it } from "vitest";
import { cifrarSecreto, comprobarSecreto } from "./contrasenas";

describe("cifrado de contraseñas y PIN", () => {
  it("comprueba el secreto correcto y rechaza otro", async () => {
    const guardado = await cifrarSecreto("2468");
    expect(guardado).not.toContain("2468");
    expect(await comprobarSecreto("2468", guardado)).toBe(true);
    expect(await comprobarSecreto("2469", guardado)).toBe(false);
  });

  it("dos cifrados del mismo secreto son distintos (sal aleatoria)", async () => {
    expect(await cifrarSecreto("x")).not.toBe(await cifrarSecreto("x"));
  });

  it("rechaza formatos desconocidos", async () => {
    expect(await comprobarSecreto("x", "md5$abc")).toBe(false);
  });
});
