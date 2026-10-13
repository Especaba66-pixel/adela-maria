"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { sinReinicio } from "@/components/sinReinicio";
import { nuevaTarea } from "./acciones";

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg";

export function FormularioTarea({ clientas, clienteId }: { clientas?: { id: string; nombre: string }[]; clienteId?: string }) {
  const [estado, accion, pendiente] = useActionState(nuevaTarea, null);
  return (
    <form key={estado?.ok ? estado.mensaje : "tarea"} onSubmit={sinReinicio(accion)} className="space-y-3" aria-label="Nueva tarea">
      {estado && (estado.ok ? <Aviso prioridad="correcto">{estado.mensaje}</Aviso> : <Aviso prioridad="urgente">{estado.error}</Aviso>)}
      {clienteId && <input type="hidden" name="cliente" value={clienteId} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className="block">
          Qué hay que hacer
          <input name="texto" required maxLength={300} placeholder="Llamar para cambiar la cita del jueves" className={campo} />
        </label>
        <label className="block">
          Para el día <span className="text-tinta-suave">(opcional)</span>
          <input name="fecha" type="date" className={campo} />
        </label>
        {clientas && (
          <label className="block sm:col-span-2">
            Clienta <span className="text-tinta-suave">(opcional)</span>
            <select name="cliente" defaultValue="" className={campo}>
              <option value="">—</option>
              {clientas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <Boton type="submit" disabled={pendiente}>
        Apuntar
      </Boton>
    </form>
  );
}
