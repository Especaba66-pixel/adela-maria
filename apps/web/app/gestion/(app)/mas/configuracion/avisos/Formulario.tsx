"use client";
import type { AjustesAvisos } from "@adela/dominio";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { sinReinicio } from "@/components/sinReinicio";
import { guardarAjustes } from "./acciones";

const casilla = "flex min-h-toque items-start gap-3";

export function FormularioAvisos({ ajustes }: { ajustes: AjustesAvisos }) {
  const [estado, accion, pendiente] = useActionState(guardarAjustes, null);
  return (
    <form onSubmit={sinReinicio(accion)} className="space-y-4" aria-label="Avisos automáticos">
      {estado && (estado.ok ? <Aviso prioridad="correcto">{estado.mensaje}</Aviso> : <Aviso prioridad="urgente">{estado.error}</Aviso>)}
      <label className={casilla}>
        <input type="checkbox" name="recordatorios" defaultChecked={ajustes.recordatorios} className="mt-1 size-6 accent-dorado-oscuro" />
        <span>
          <strong>Recordatorios</strong>: el día antes, recordar la cita a cada clienta.
        </span>
      </label>
      <label className={casilla}>
        <input type="checkbox" name="seguimiento" defaultChecked={ajustes.seguimiento} className="mt-1 size-6 accent-dorado-oscuro" />
        <span>
          <strong>Seguimiento</strong>: el día después, preguntar qué tal el tratamiento.
        </span>
      </label>
      <label className={casilla}>
        <input type="checkbox" name="bonos" defaultChecked={ajustes.bonos} className="mt-1 size-6 accent-dorado-oscuro" />
        <span>
          <strong>Bonos</strong>: cuando quede una sesión, ofrecer renovarlo.
        </span>
      </label>
      <label className={casilla}>
        <input type="checkbox" name="cumpleanos" defaultChecked={ajustes.cumpleanos} className="mt-1 size-6 accent-dorado-oscuro" />
        <span>
          <strong>Cumpleaños</strong>: felicitar a las clientas que tienen la fecha en su ficha (solo si aceptan promociones).
        </span>
      </label>
      <label className="block max-w-sm">
        <strong>Clientas que no vuelven</strong>: avisar cuando lleven sin venir (días, 0 = no avisar)
        <input name="dias" inputMode="numeric" defaultValue={ajustes.diasInactiva} className="mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg" />
      </label>
      <Boton type="submit" disabled={pendiente}>
        Guardar
      </Boton>
    </form>
  );
}
