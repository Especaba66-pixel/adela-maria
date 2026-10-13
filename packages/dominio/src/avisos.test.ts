import { describe, expect, it } from "vitest";
import {
  AJUSTES_AVISOS_INICIALES,
  PLANTILLAS_INICIALES,
  diasEntre,
  esCumpleanos,
  estaInactiva,
  leerAjustesAvisos,
  ordenarPorPrioridad,
  rellenarPlantilla,
  validarPlantilla,
} from "./avisos";

describe("plantillas", () => {
  it("rellena las variables y quita las vacías sin dejar huecos", () => {
    expect(rellenarPlantilla("Hola, {nombre}. Cita el {fecha} a las {hora}.", { nombre: "Marta", fecha: "martes 14", hora: "10:00" })).toBe(
      "Hola, Marta. Cita el martes 14 a las 10:00.",
    );
    expect(rellenarPlantilla("Hola {nombre} , te esperamos", {})).toBe("Hola, te esperamos");
  });

  it("todas las plantillas de partida son válidas", () => {
    for (const p of PLANTILLAS_INICIALES) expect(validarPlantilla(p.texto)).toBeNull();
  });

  it("avisa de variables que no existen", () => {
    expect(validarPlantilla("Hola {nombr}")).toMatch(/No existe \{nombr\}/);
    expect(validarPlantilla("")).toMatch(/Escribe/);
  });
});

describe("reglas", () => {
  it("ordena por urgencia", () => {
    const l = ordenarPorPrioridad([{ prioridad: "informativo" as const }, { prioridad: "urgente" as const }, { prioridad: "pendiente" as const }]);
    expect(l.map((x) => x.prioridad)).toEqual(["urgente", "pendiente", "informativo"]);
  });

  it("ajustes con valores por defecto y saneados", () => {
    expect(leerAjustesAvisos(null)).toEqual(AJUSTES_AVISOS_INICIALES);
    expect(leerAjustesAvisos({ recordatorios: false, diasInactiva: -3 })).toMatchObject({ recordatorios: false, diasInactiva: 90 });
  });

  it("cumpleaños, también el de quien nació un 29 de febrero", () => {
    expect(esCumpleanos("1990-10-13", "2026-10-13")).toBe(true);
    expect(esCumpleanos("1990-10-14", "2026-10-13")).toBe(false);
    expect(esCumpleanos("1992-02-29", "2026-02-28")).toBe(true);
    expect(esCumpleanos("1992-02-29", "2028-02-28")).toBe(false);
    expect(esCumpleanos(null, "2026-10-13")).toBe(false);
  });

  it("inactiva: vino alguna vez, hace tiempo, y no tiene cita por delante", () => {
    expect(diasEntre("2026-07-01", "2026-10-13")).toBe(104);
    expect(estaInactiva("2026-07-01", false, "2026-10-13", 90)).toBe(true);
    expect(estaInactiva("2026-07-01", true, "2026-10-13", 90)).toBe(false);
    expect(estaInactiva("2026-09-01", false, "2026-10-13", 90)).toBe(false);
    expect(estaInactiva(null, false, "2026-10-13", 90)).toBe(false);
    expect(estaInactiva("2020-01-01", false, "2026-10-13", 0)).toBe(false);
  });
});
