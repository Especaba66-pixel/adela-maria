"use client";
import { useEffect } from "react";

/**
 * Si no se toca la pantalla en los minutos indicados, recarga: el servidor ve la sesión caducada
 * y lleva a la pantalla de PIN. El servidor lo comprueba igualmente en cada petición.
 */
export function VigilanteInactividad({ minutos }: { minutos: number }) {
  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout>;
    const reiniciar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => window.location.reload(), minutos * 60_000 + 5_000);
    };
    const eventos = ["pointerdown", "keydown", "scroll"] as const;
    eventos.forEach((e) => window.addEventListener(e, reiniciar, { passive: true }));
    reiniciar();
    return () => {
      clearTimeout(temporizador);
      eventos.forEach((e) => window.removeEventListener(e, reiniciar));
    };
  }, [minutos]);
  return null;
}
