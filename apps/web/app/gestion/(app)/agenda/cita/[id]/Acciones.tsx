"use client";
import { NOMBRE_ESTADO, type EstadoCita } from "@adela/dominio";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { cambiarEstado, cancelarSerie, mover } from "./acciones";

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg";
const ETIQUETA: Partial<Record<EstadoCita, string>> = {
  confirmada: "Confirmar",
  realizada: "Ha venido · realizada",
  no_presentada: "No ha venido",
  cancelada: "Cancelar cita",
};

function Mensaje({ e }: { e: { error?: string; ok?: string } }) {
  if (e.error) return <Aviso prioridad="urgente">{e.error}</Aviso>;
  if (e.ok) return <Aviso prioridad="correcto">{e.ok}</Aviso>;
  return null;
}

export function BotonesEstado({ id, posibles, actual }: { id: string; posibles: EstadoCita[]; actual: EstadoCita }) {
  const [estado, accion, pendiente] = useActionState(cambiarEstado, {});
  return (
    <div className="space-y-3">
      <Mensaje e={estado} />
      <div className="flex flex-wrap gap-3">
        {posibles.map((p) => (
          <form key={p} action={accion}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="estado" value={p} />
            <Boton
              type="submit"
              disabled={pendiente}
              variante={p === "cancelada" ? "peligro" : p === "no_presentada" ? "secundario" : "principal"}
              onClick={(e) => {
                if (p === "cancelada" && !confirm("¿Cancelar esta cita? Su hueco quedará libre.")) e.preventDefault();
              }}
            >
              {actual === "realizada" || actual === "no_presentada" ? `Volver a «${NOMBRE_ESTADO[p]}»` : ETIQUETA[p]}
            </Boton>
          </form>
        ))}
      </div>
    </div>
  );
}

export function FormularioMover({ id, fecha, hora, profesionalId, equipo }: { id: string; fecha: string; hora: string; profesionalId: string; equipo: { id: string; nombre: string }[] }) {
  const [estado, accion, pendiente] = useActionState(mover, {});
  return (
    <form action={accion} className="space-y-3">
      <Mensaje e={estado} />
      <input type="hidden" name="id" value={id} />
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          Día
          <input name="fecha" type="date" defaultValue={fecha} required className={campo} />
        </label>
        <label className="block">
          Hora
          <input name="hora" type="time" step={300} defaultValue={hora} required className={campo} />
        </label>
        <label className="block">
          Profesional
          <select name="profesional" defaultValue={profesionalId} className={campo}>
            {equipo.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Boton type="submit" variante="secundario" disabled={pendiente}>
        Cambiar hora
      </Boton>
    </form>
  );
}

export function BotonCancelarSerie({ id }: { id: string }) {
  const [estado, accion, pendiente] = useActionState(cancelarSerie, {});
  return (
    <form action={accion} className="space-y-2">
      <Mensaje e={estado} />
      <input type="hidden" name="id" value={id} />
      <Boton
        type="submit"
        variante="discreto"
        disabled={pendiente}
        onClick={(e) => {
          if (!confirm("¿Cancelar esta cita y todas las siguientes de la serie?")) e.preventDefault();
        }}
      >
        Cancelar esta y las siguientes de la serie
      </Boton>
    </form>
  );
}
