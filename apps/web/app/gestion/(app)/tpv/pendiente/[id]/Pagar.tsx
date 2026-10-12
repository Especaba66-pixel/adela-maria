"use client";
import { METODOS_CAJA, NOMBRE_METODO, cambio, formatearEuros } from "@adela/dominio";
import { Aviso, Boton } from "@adela/ui";
import { useState, useTransition } from "react";
import { TecladoImporte } from "@/components/TecladoImporte";
import { cobrarDeuda } from "../../acciones";

export function PagarPendiente({ ventaId, pendiente }: { ventaId: string; pendiente: number }) {
  const [metodo, setMetodo] = useState<(typeof METODOS_CAJA)[number] | null>(null);
  const [importe, setImporte] = useState(pendiente);
  const [entregado, setEntregado] = useState(pendiente);
  const [error, setError] = useState<string | null>(null);
  const [cobrando, iniciar] = useTransition();
  return (
    <div className="max-w-md space-y-4">
      {error && <Aviso prioridad="urgente">{error}</Aviso>}
      <TecladoImporte centimos={importe} onCambio={(c) => (setImporte(Math.min(c, pendiente)), setEntregado(Math.min(c, pendiente)))} etiqueta="Importe a cobrar" />
      <div className="grid grid-cols-3 gap-2">
        {METODOS_CAJA.map((m) => (
          <Boton key={m} variante={metodo === m ? "principal" : "secundario"} onClick={() => setMetodo(m)} className="h-16">
            {NOMBRE_METODO[m]}
          </Boton>
        ))}
      </div>
      {metodo === "efectivo" && (
        <>
          <TecladoImporte centimos={entregado} onCambio={setEntregado} etiqueta="Entregado" atajos={[importe, 1000, 2000, 5000].filter((v, i, a) => v >= importe && a.indexOf(v) === i)} />
          <p className="text-xl">Cambio: {formatearEuros(cambio(importe, entregado))}</p>
        </>
      )}
      <Boton
        grande
        className="w-full"
        disabled={!metodo || importe === 0 || cobrando || (metodo === "efectivo" && entregado < importe)}
        onClick={() =>
          iniciar(async () => {
            const r = await cobrarDeuda(ventaId, { metodo: metodo!, importe, ...(metodo === "efectivo" ? { entregado } : {}) });
            if (r?.error) setError(r.error);
          })
        }
      >
        Cobrar {formatearEuros(importe)}
      </Boton>
    </div>
  );
}
