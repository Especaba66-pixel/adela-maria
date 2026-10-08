import { describe, expect, it } from "vitest";
import {
  dentroDeHorario,
  diaSemana,
  diasCalendarioMes,
  duracionTotal,
  esFecha,
  fechasSerie,
  horaATexto,
  huecosLibres,
  instanteMadrid,
  lunesDeLaSemana,
  partesMadrid,
  puedeCambiarEstado,
  textoAHora,
  validarHorarioDia,
} from "./agenda";

const h = (hh: number, mm = 0) => hh * 60 + mm;

describe("horas de Madrid", () => {
  it("convierte hora de Madrid a instante, en verano y en invierno", () => {
    expect(instanteMadrid("2026-07-01", h(10)).toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(instanteMadrid("2026-12-01", h(10)).toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });

  it("aguanta el día del cambio de hora de octubre (a las 3 vuelven a ser las 2)", () => {
    expect(instanteMadrid("2026-10-25", h(1)).toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(instanteMadrid("2026-10-25", h(10)).toISOString()).toBe("2026-10-25T09:00:00.000Z");
  });

  it("aguanta el día del cambio de hora de marzo", () => {
    expect(instanteMadrid("2026-03-29", h(1)).toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(instanteMadrid("2026-03-29", h(10)).toISOString()).toBe("2026-03-29T08:00:00.000Z");
  });

  it("y vuelve a partes de Madrid", () => {
    expect(partesMadrid(new Date("2026-10-25T09:30:00Z"))).toEqual({ fecha: "2026-10-25", minutos: h(10, 30) });
    expect(partesMadrid(new Date("2026-10-08T22:30:00Z"))).toEqual({ fecha: "2026-10-09", minutos: h(0, 30) });
  });
});

describe("calendario", () => {
  it("día de la semana y lunes", () => {
    expect(diaSemana("2026-10-08")).toBe(4);
    expect(diaSemana("2026-10-11")).toBe(7);
    expect(lunesDeLaSemana("2026-10-11")).toBe("2026-10-05");
  });

  it("el mes se ve en semanas completas", () => {
    const dias = diasCalendarioMes("2026-10-15");
    expect(dias[0]).toBe("2026-09-28");
    expect(dias.at(-1)).toBe("2026-11-01");
    expect(dias.length % 7).toBe(0);
  });

  it("fechas válidas", () => {
    expect(esFecha("2026-02-28")).toBe(true);
    expect(esFecha("2026-02-30")).toBe(false);
    expect(esFecha("ayer")).toBe(false);
  });

  it("horas en texto", () => {
    expect(horaATexto(h(9, 5))).toBe("09:05");
    expect(textoAHora("9:30")).toBe(h(9, 30));
    expect(textoAHora("24:00")).toBeNull();
  });
});

describe("huecos libres", () => {
  const fecha = "2026-10-13";
  const horario = [
    { inicio: h(10), fin: h(14) },
    { inicio: h(16), fin: h(20) },
  ];
  const cita = (desde: number, hasta: number) => ({ inicio: instanteMadrid(fecha, desde), fin: instanteMadrid(fecha, hasta) });

  it("ofrece horas dentro del horario donde cabe el servicio entero", () => {
    const libres = huecosLibres({ fecha, horario, ocupados: [], duracion: 90, paso: 15 });
    expect(libres[0]).toBe(h(10));
    expect(libres).toContain(h(12, 30));
    expect(libres).not.toContain(h(12, 45)); // acabaría a las 14:15
    expect(libres).toContain(h(16));
    expect(libres.at(-1)).toBe(h(18, 30));
  });

  it("no pisa citas ni bloqueos", () => {
    const libres = huecosLibres({ fecha, horario, ocupados: [cita(h(11), h(12))], duracion: 30, paso: 15 });
    expect(libres).toContain(h(10, 30));
    expect(libres).not.toContain(h(10, 45));
    expect(libres).not.toContain(h(11, 30));
    expect(libres).toContain(h(12));
  });

  it("respeta la antelación mínima", () => {
    const libres = huecosLibres({ fecha, horario, ocupados: [], duracion: 30, paso: 15, desde: instanteMadrid(fecha, h(17)) });
    expect(libres[0]).toBe(h(17));
  });

  it("sin horario no hay huecos", () => {
    expect(huecosLibres({ fecha, horario: [], ocupados: [], duracion: 30, paso: 15 })).toEqual([]);
  });

  it("dentro de horario", () => {
    expect(dentroDeHorario(horario, h(13), 60)).toBe(true);
    expect(dentroDeHorario(horario, h(13, 30), 60)).toBe(false);
  });
});

describe("horario de un día", () => {
  it("valida los tramos", () => {
    expect(validarHorarioDia([{ inicio: h(10), fin: h(14) }, { inicio: h(16), fin: h(20) }])).toBeNull();
    expect(validarHorarioDia([{ inicio: h(14), fin: h(10) }])).toMatch(/empezar antes/);
    expect(validarHorarioDia([{ inicio: h(10, 2), fin: h(14) }])).toMatch(/5 en 5/);
    expect(validarHorarioDia([{ inicio: h(10), fin: h(14) }, { inicio: h(13), fin: h(20) }])).toMatch(/pisarse/);
  });
});

describe("citas", () => {
  it("estados permitidos", () => {
    expect(puedeCambiarEstado("pendiente", "confirmada")).toBe(true);
    expect(puedeCambiarEstado("confirmada", "realizada")).toBe(true);
    expect(puedeCambiarEstado("realizada", "confirmada")).toBe(true);
    expect(puedeCambiarEstado("cancelada", "confirmada")).toBe(false);
    expect(puedeCambiarEstado("pendiente", "realizada")).toBe(false);
  });

  it("duración total de varios servicios", () => {
    expect(duracionTotal([{ duracionMinutos: 10 }, { duracionMinutos: 5 }])).toBe(15);
    expect(duracionTotal([{ duracionMinutos: 10 }, { duracionMinutos: null }])).toBeNull();
    expect(duracionTotal([])).toBeNull();
  });

  it("citas recurrentes", () => {
    expect(fechasSerie("2026-10-13", 2, 3)).toEqual(["2026-10-13", "2026-10-27", "2026-11-10"]);
  });
});

describe("tramos libres del día", () => {
  it("quita lo ocupado del horario", async () => {
    const { tramosLibres } = await import("./agenda");
    const horario = [
      { inicio: h(10), fin: h(14) },
      { inicio: h(16), fin: h(20) },
    ];
    expect(tramosLibres(horario, [{ inicio: h(11), fin: h(12) }, { inicio: h(13, 30), fin: h(16, 30) }])).toEqual([
      { inicio: h(10), fin: h(11) },
      { inicio: h(12), fin: h(13, 30) },
      { inicio: h(16, 30), fin: h(20) },
    ]);
    expect(tramosLibres(horario, [{ inicio: h(9), fin: h(21) }])).toEqual([]);
  });

  it("pasa un intervalo a minutos del día, recortado a ese día", async () => {
    const { aMinutosDelDia } = await import("./agenda");
    const fecha = "2026-10-13";
    expect(aMinutosDelDia(fecha, { inicio: instanteMadrid(fecha, h(10)), fin: instanteMadrid(fecha, h(11, 30)) })).toEqual({ inicio: h(10), fin: h(11, 30) });
    // Vacaciones de varios días: ocupa el día entero.
    expect(aMinutosDelDia(fecha, { inicio: new Date("2026-10-01T00:00:00Z"), fin: new Date("2026-10-20T00:00:00Z") })).toEqual({ inicio: 0, fin: 1440 });
  });
});
