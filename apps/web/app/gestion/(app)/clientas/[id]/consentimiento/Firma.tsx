"use client";
import { Aviso, Boton } from "@adela/ui";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { firmar } from "../acciones-fichas";

/** Recuadro para firmar con el dedo, y el botón que guarda el consentimiento firmado. */
export function Firma({ clienteId, modeloId, citaId, nombre }: { clienteId: string; modeloId: string; citaId?: string; nombre: string }) {
  const [estado, accion, pendiente] = useActionState(firmar, null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [trazos, setTrazos] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const c = lienzo.current!;
    c.width = c.offsetWidth;
    c.height = c.offsetHeight;
    const g = c.getContext("2d")!;
    g.lineWidth = 3;
    g.lineCap = "round";
    g.strokeStyle = "#2b2118";
  }, []);

  const punto = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  function empezar(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const g = e.currentTarget.getContext("2d")!;
    const [x, y] = punto(e);
    g.beginPath();
    g.moveTo(x, y);
  }
  function mover(e: PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const g = e.currentTarget.getContext("2d")!;
    const [x, y] = punto(e);
    g.lineTo(x, y);
    g.stroke();
  }
  function acabar() {
    if (dibujando.current) setTrazos((n) => n + 1);
    dibujando.current = false;
  }
  function borrar() {
    const c = lienzo.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setTrazos(0);
  }
  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (trazos === 0) return setAviso("Falta la firma.");
    setAviso(null);
    const datos = new FormData(e.currentTarget);
    datos.set("firma", lienzo.current!.toDataURL("image/png"));
    startTransition(() => accion(datos));
  }

  return (
    <form onSubmit={enviar} className="space-y-3" aria-label="Firmar">
      {(aviso || (estado && !estado.ok)) && <Aviso prioridad="urgente">{aviso ?? (estado && !estado.ok ? estado.error : "")}</Aviso>}
      <input type="hidden" name="cliente" value={clienteId} />
      <input type="hidden" name="modelo" value={modeloId} />
      {citaId && <input type="hidden" name="cita" value={citaId} />}
      <label className="block">
        Nombre de quien firma
        <input name="firmante" required defaultValue={nombre} className="mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg" />
      </label>
      <div>
        <div className="mb-1">Firma aquí con el dedo</div>
        <canvas
          ref={lienzo}
          aria-label="Recuadro de firma"
          data-testid="firma"
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={acabar}
          onPointerLeave={acabar}
          className="h-48 w-full touch-none rounded-xl border-2 border-dashed border-dorado bg-white"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Firmar"}
        </Boton>
        <Boton type="button" variante="discreto" onClick={borrar}>
          Borrar la firma
        </Boton>
      </div>
    </form>
  );
}
