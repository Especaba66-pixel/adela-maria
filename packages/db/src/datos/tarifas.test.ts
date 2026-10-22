import { describe, expect, it } from "vitest";
import { BONOS, CATEGORIAS } from "./tarifas";

const categoria = (nombre: string) => CATEGORIAS.find((c) => c.nombre === nombre)!;

describe("tarifas del centro", () => {
  it("tienen los 7 faciales y los 11 servicios de depilación de las hojas de tarifas", () => {
    expect(categoria("Faciales").tratamientos).toHaveLength(7);
    expect(categoria("Depilación").tratamientos).toHaveLength(11);
  });

  it("todo tiene precio y duración salvo las uñas (por decidir)", () => {
    const sinPrecio = CATEGORIAS.flatMap((c) => c.tratamientos).filter((t) => t.precioCentimos === undefined || t.duracionMinutos === undefined);
    expect(sinPrecio.map((t) => t.nombre)).toEqual(["Uñas"]);
  });

  it("el bono de presoterapia solo cubre la presoterapia", () => {
    const b = BONOS.find((x) => x.nombre === "Bono presoterapia 7 sesiones")!;
    const cubiertos = categoria(b.categoria).tratamientos.filter((t) => !b.excepto?.includes(t.nombre)).map((t) => t.nombre);
    expect(cubiertos).toEqual(["Presoterapia (1 sesión)"]);
  });

  it("las duraciones van en tramos de 5 minutos y los precios en céntimos enteros", () => {
    for (const c of CATEGORIAS) {
      for (const t of c.tratamientos) {
        if (t.duracionMinutos !== undefined) expect(t.duracionMinutos % 5, t.nombre).toBe(0);
        if (t.precioCentimos !== undefined) expect(Number.isInteger(t.precioCentimos), t.nombre).toBe(true);
      }
    }
  });

  it("no hay nombres repetidos dentro de una categoría", () => {
    for (const c of CATEGORIAS) expect(new Set(c.tratamientos.map((t) => t.nombre)).size).toBe(c.tratamientos.length);
  });

  it("los bonos apuntan a tratamientos que existen", () => {
    for (const b of BONOS) {
      const nombres = categoria(b.categoria).tratamientos.map((t) => t.nombre);
      for (const e of b.excepto ?? []) expect(nombres).toContain(e);
    }
  });
});
