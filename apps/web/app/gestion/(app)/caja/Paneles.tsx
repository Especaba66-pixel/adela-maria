"use client";
import { formatearEuros } from "@adela/dominio";
import { Aviso, Boton, Tarjeta } from "@adela/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TecladoImporte } from "@/components/TecladoImporte";
import { abrir, cajonAccion, cerrar, movimiento } from "./acciones";

function Mensaje({ e }: { e: { ok?: string; error?: string } }) {
  if (e.error) return <Aviso prioridad="urgente">{e.error}</Aviso>;
  if (e.ok) return <Aviso prioridad="correcto">{e.ok}</Aviso>;
  return null;
}

export function AbrirCaja({ sugerido }: { sugerido: number }) {
  const [centimos, setCentimos] = useState(sugerido);
  const [estado, setEstado] = useState<{ ok?: string; error?: string }>({});
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <Tarjeta className="max-w-md space-y-4">
      <h2 className="text-2xl">Abrir caja</h2>
      <p className="text-tinta-suave">Cuenta el efectivo con el que empiezas el día (el fondo para dar cambio).</p>
      <Mensaje e={estado} />
      <TecladoImporte centimos={centimos} onCambio={setCentimos} etiqueta="Fondo inicial" />
      <Boton grande className="w-full" disabled={pendiente} onClick={() => iniciar(async () => (setEstado(await abrir(centimos)), router.refresh()))}>
        Abrir caja con {formatearEuros(centimos)}
      </Boton>
    </Tarjeta>
  );
}

export function MovimientoCaja() {
  const [tipo, setTipo] = useState<"entrada" | "salida">("salida");
  const [centimos, setCentimos] = useState(0);
  const [concepto, setConcepto] = useState("");
  const [estado, setEstado] = useState<{ ok?: string; error?: string }>({});
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <Tarjeta className="space-y-4">
      <h2 className="text-2xl">Meter o sacar efectivo</h2>
      <Mensaje e={estado} />
      <div className="flex gap-2">
        {(["salida", "entrada"] as const).map((t) => (
          <Boton key={t} type="button" variante={tipo === t ? "principal" : "secundario"} onClick={() => setTipo(t)} className="flex-1">
            {t === "salida" ? "Sacar" : "Meter"}
          </Boton>
        ))}
      </div>
      <TecladoImporte centimos={centimos} onCambio={setCentimos} etiqueta="Importe del movimiento" />
      <label className="block">
        Motivo
        <input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Compra de algodón, cambio del banco…" className="mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg" />
      </label>
      <Boton
        className="w-full"
        disabled={pendiente || centimos === 0}
        onClick={() =>
          iniciar(async () => {
            const r = await movimiento(tipo, centimos, concepto);
            setEstado(r);
            if (r.ok) (setCentimos(0), setConcepto(""), router.refresh());
          })
        }
      >
        Anotar {tipo === "salida" ? "salida" : "entrada"}
      </Boton>
    </Tarjeta>
  );
}

export function CerrarCaja({ esperado }: { esperado: number }) {
  const [centimos, setCentimos] = useState(0);
  const [notas, setNotas] = useState("");
  const [estado, setEstado] = useState<{ ok?: string; error?: string }>({});
  const [pendiente, iniciar] = useTransition();
  const diferencia = centimos - esperado;
  return (
    <Tarjeta className="space-y-4">
      <h2 className="text-2xl">Cerrar caja</h2>
      <Mensaje e={estado} />
      <p className="text-tinta-suave">Cuenta el efectivo del cajón y escríbelo. Debería haber {formatearEuros(esperado)}.</p>
      <TecladoImporte centimos={centimos} onCambio={setCentimos} etiqueta="Efectivo contado" />
      {centimos > 0 && (
        <p className={diferencia === 0 ? "font-semibold text-correcto" : "font-semibold text-urgente"} data-testid="diferencia">
          {diferencia === 0 ? "Cuadra." : `${diferencia > 0 ? "Sobran" : "Faltan"} ${formatearEuros(Math.abs(diferencia))}.`}
        </p>
      )}
      <label className="block">
        Notas <span className="text-tinta-suave">(opcional)</span>
        <input value={notas} onChange={(e) => setNotas(e.target.value)} className="mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg" />
      </label>
      <Boton
        variante="peligro"
        className="w-full"
        disabled={pendiente}
        onClick={() => {
          if (!confirm(`¿Cerrar la caja con ${formatearEuros(centimos)} contados?`)) return;
          iniciar(async () => {
            const r = await cerrar(centimos, notas);
            if (r?.error) setEstado(r);
          });
        }}
      >
        Cerrar caja
      </Boton>
    </Tarjeta>
  );
}

export function BotonCajon() {
  const [estado, setEstado] = useState<{ ok?: string; error?: string }>({});
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="space-y-2">
      <Boton variante="secundario" disabled={pendiente} onClick={() => iniciar(async () => setEstado(await cajonAccion()))}>
        Abrir cajón
      </Boton>
      <Mensaje e={estado} />
    </div>
  );
}
