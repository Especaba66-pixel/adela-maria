import { describe, expect, it } from "vitest";
import { buscar, coincide } from "./busqueda";

const nombres = ["Diseño y depilación de cejas", "Ceja y labio", "Laminado de cejas", "Axilas", "Aceite de argán 100 % puro", "Ingles"];

describe("búsqueda del TPV", () => {
  it("no distingue tildes ni mayúsculas y busca cada palabra", () => {
    expect(coincide("Diseño y depilación de cejas", "diseno")).toBe(true);
    expect(coincide("Diseño y depilación de cejas", "DEPILACION cejas")).toBe(true);
    expect(coincide("Diseño y depilación de cejas", "cejas diseño")).toBe(true);
    expect(coincide("Diseño y depilación de cejas", "labio")).toBe(false);
    expect(coincide("Axilas", "  ")).toBe(false);
  });

  it("primero lo que empieza por lo escrito, luego por orden alfabético, y con límite", () => {
    expect(buscar(nombres, "ceja", (n) => n)).toEqual(["Ceja y labio", "Diseño y depilación de cejas", "Laminado de cejas"]);
    expect(buscar(nombres, "a", (n) => n, 2)).toEqual(["Aceite de argán 100 % puro", "Axilas"]);
    expect(buscar(nombres, "nada", (n) => n)).toEqual([]);
  });
});
