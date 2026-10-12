"use client";
import { formatearEuros } from "@adela/dominio";
import { Boton } from "@adela/ui";

/**
 * Teclado numérico para importes. Se escriben céntimos de derecha a izquierda, como en un datáfono:
 * 1 → 0,01 €; 1 5 0 0 → 15,00 €. Así nunca hace falta la coma.
 */
export function TecladoImporte({
  centimos,
  onCambio,
  etiqueta,
  atajos = [],
}: {
  centimos: number;
  onCambio: (c: number) => void;
  etiqueta: string;
  /** Importes rápidos (por ejemplo, billetes). */
  atajos?: number[];
}) {
  const pulsar = (t: string) => {
    if (t === "borrar") onCambio(Math.floor(centimos / 10));
    else if (t === "00") onCambio(Math.min(centimos * 100, 99_999_99));
    else onCambio(Math.min(centimos * 10 + Number(t), 99_999_99));
  };
  return (
    <div role="group" aria-label={etiqueta} className="space-y-3">
      <div role="status" className="rounded-xl border-2 border-borde bg-superficie px-4 py-3 text-right font-titulo text-4xl" data-testid="importe">
        {formatearEuros(centimos)}
      </div>
      {atajos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {atajos.map((a) => (
            <Boton key={a} type="button" variante="secundario" onClick={() => onCambio(a)} className="flex-1">
              {formatearEuros(a).replace(",00", "").replace("\u00a0", " ")}
            </Boton>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "borrar"].map((t) => (
          <Boton key={t} type="button" variante={t === "borrar" ? "discreto" : "secundario"} onClick={() => pulsar(t)} className="h-16 text-2xl" aria-label={t === "borrar" ? "Borrar cifra" : t}>
            {t === "borrar" ? "⌫" : t}
          </Boton>
        ))}
      </div>
    </div>
  );
}
