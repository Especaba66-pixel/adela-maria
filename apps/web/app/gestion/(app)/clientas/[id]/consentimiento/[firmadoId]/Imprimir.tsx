"use client";
import { Boton } from "@adela/ui";

export function Imprimir() {
  return (
    <Boton type="button" variante="secundario" onClick={() => window.print()}>
      Imprimir
    </Boton>
  );
}
