"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState, useState } from "react";
import { crearBloqueo } from "./acciones";

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg";

export function FormularioBloqueo({ equipo, hoy }: { equipo: { id: string; nombre: string }[]; hoy: string }) {
  const [estado, accion, pendiente] = useActionState(crearBloqueo, {});
  const [diaEntero, setDiaEntero] = useState(true);
  return (
    <form action={accion} className="space-y-4">
      {estado.error && <Aviso prioridad="urgente">{estado.error}</Aviso>}
      {estado.ok && <Aviso prioridad="correcto">{estado.ok}</Aviso>}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          Quién
          <select name="profesional" className={campo}>
            <option value="">Todo el centro</option>
            {equipo.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Tipo
          <select name="tipo" className={campo}>
            <option value="vacaciones">Vacaciones o cierre</option>
            <option value="descanso">Descanso</option>
            <option value="otro">Otro</option>
          </select>
        </label>
        <label className="block">
          Desde el día
          <input name="desde" type="date" required defaultValue={hoy} className={campo} />
        </label>
        <label className="block">
          Hasta el día
          <input name="hasta" type="date" defaultValue={hoy} className={campo} />
        </label>
        <label className="col-span-2 flex min-h-toque items-center gap-3">
          <input name="diaEntero" type="checkbox" checked={diaEntero} onChange={(e) => setDiaEntero(e.target.checked)} className="size-6 accent-dorado-oscuro" />
          Días enteros
        </label>
        {!diaEntero && (
          <>
            <label className="block">
              Desde la hora
              <input name="horaDesde" type="time" step={300} required className={campo} />
            </label>
            <label className="block">
              Hasta la hora
              <input name="horaHasta" type="time" step={300} required className={campo} />
            </label>
          </>
        )}
        <label className="col-span-2 block">
          Motivo <span className="text-tinta-suave">(opcional)</span>
          <input name="motivo" maxLength={120} className={campo} />
        </label>
      </div>
      <Boton type="submit" disabled={pendiente}>
        Guardar bloqueo
      </Boton>
    </form>
  );
}
