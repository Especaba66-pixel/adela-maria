import { describe, expect, it } from "vitest";
import { MAX_INTENTOS_FALLIDOS, estaBloqueado, sesionCaducada, trasIntentoFallido } from "./sesion";

const ahora = new Date("2026-10-08T10:00:00Z");
const hace = (min: number) => new Date(ahora.getTime() - min * 60_000);

describe("sesión", () => {
  it("caduca tras los minutos de inactividad", () => {
    expect(sesionCaducada(hace(14), ahora, 15)).toBe(false);
    expect(sesionCaducada(hace(16), ahora, 15)).toBe(true);
  });

  it("bloquea tras el máximo de intentos fallidos y se desbloquea solo", () => {
    let estado = { intentos: 0, bloqueadoHasta: null as Date | null };
    for (let i = 1; i < MAX_INTENTOS_FALLIDOS; i++) {
      estado = trasIntentoFallido(estado.intentos, ahora);
      expect(estado.bloqueadoHasta).toBeNull();
    }
    estado = trasIntentoFallido(estado.intentos, ahora);
    expect(estado.bloqueadoHasta).not.toBeNull();
    expect(estado.intentos).toBe(0);
    expect(estaBloqueado(estado.bloqueadoHasta, ahora)).toBe(true);
    expect(estaBloqueado(estado.bloqueadoHasta, new Date(ahora.getTime() + 6 * 60_000))).toBe(false);
  });
});
