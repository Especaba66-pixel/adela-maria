import { instanteMadrid } from "@adela/dominio/agenda";
import { describe, expect, it } from "vitest";
import { estaLibre, horasLibres, intervalo, type Estado, type Servicio } from "./disponibilidad";

const FECHA = "2026-11-04"; // miércoles
const AHORA = new Date("2026-11-01T10:00:00Z");
const facial: Servicio = { id: "f", nombre: "Facial", categoria: "Faciales", duracion: 60, exclusivo: false, precio: 4500 };
const maquillaje: Servicio = { id: "m", nombre: "Maquillaje", categoria: "Otros", duracion: 60, exclusivo: true, precio: 5000 };

const cita = (desde: number, duracion: number, exclusiva = false) => ({ ...intervalo(FECHA, desde, duracion), exclusiva, bloqueo: false });
const estado = (ocupado: Estado["ocupado"] = [], cabinas = 3): Estado => ({ horario: [{ diaSemana: 3, inicio: 9 * 60, fin: 14 * 60 }], ocupado, cabinas });
const a10 = 10 * 60;

describe("horas libres por internet", () => {
  it("dentro del horario, de 15 en 15 minutos, cabiendo el tratamiento entero", () => {
    const horas = horasLibres(estado(), facial, FECHA, AHORA);
    expect(horas[0]).toBe(9 * 60);
    expect(horas.at(-1)).toBe(13 * 60);
    expect(horas.every((h) => h % 15 === 0)).toBe(true);
    expect(horasLibres(estado(), facial, "2026-11-07", AHORA)).toEqual([]); // sábado: cerrado
  });

  it("hasta tres citas a la vez; la cuarta ya no cabe", () => {
    expect(estaLibre(estado([cita(a10, 60), cita(a10, 60)]), facial, FECHA, a10, AHORA)).toBe(true);
    expect(estaLibre(estado([cita(a10, 60), cita(a10, 60), cita(a10, 60)]), facial, FECHA, a10, AHORA)).toBe(false);
    // Tres que no coinciden entre sí no llenan nada.
    expect(estaLibre(estado([cita(a10, 15), cita(a10 + 15, 15), cita(a10 + 30, 15)]), facial, FECHA, a10, AHORA)).toBe(true);
  });

  it("microblading, maquillaje y uñas van solos: ni con cabinas libres admiten nada a la vez", () => {
    expect(estaLibre(estado([cita(a10, 60)]), maquillaje, FECHA, a10, AHORA)).toBe(false);
    expect(estaLibre(estado([cita(a10, 60, true)]), facial, FECHA, a10, AHORA)).toBe(false);
    expect(estaLibre(estado([cita(a10, 60, true)]), facial, FECHA, a10 + 60, AHORA)).toBe(true);
  });

  it("los bloqueos (vacaciones, descansos) cierran esas horas", () => {
    const vacaciones = { ...intervalo(FECHA, 0, 24 * 60), exclusiva: false, bloqueo: true };
    expect(horasLibres(estado([vacaciones]), facial, FECHA, AHORA)).toEqual([]);
  });

  it("no se reserva con menos de dos horas de antelación, ni en el pasado, ni a más de 60 días", () => {
    const casiYa = new Date(instanteMadrid(FECHA, a10).getTime() - 60 * 60_000);
    expect(estaLibre(estado(), facial, FECHA, a10, casiYa)).toBe(false);
    expect(estaLibre(estado(), facial, FECHA, 13 * 60, casiYa)).toBe(true);
    expect(horasLibres(estado(), facial, "2026-10-01", AHORA)).toEqual([]);
    expect(horasLibres(estado(), facial, "2027-03-01", AHORA)).toEqual([]);
  });
});
