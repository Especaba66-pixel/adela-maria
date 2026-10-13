"use client";
import { CATEGORIAS_META, NOMBRE_CATEGORIA_META } from "@adela/dominio";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { sinReinicio } from "@/components/sinReinicio";
import { guardarAutomatico, guardarMeta } from "./acciones";

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg";

/** Datos de la plantilla tal y como la aprobó Meta. */
export function FormularioMeta({
  clave,
  nombre,
  valores,
}: {
  clave: string;
  nombre: string;
  valores: { metaNombre: string; metaIdioma: string; metaCategoria: string; metaVariables: string; metaBotones: boolean };
}) {
  const [estado, accion, pendiente] = useActionState(guardarMeta, null);
  return (
    <form onSubmit={sinReinicio(accion)} className="space-y-3" aria-label={`Meta: ${nombre}`}>
      {estado && (estado.ok ? <Aviso prioridad="correcto">{estado.mensaje}</Aviso> : <Aviso prioridad="urgente">{estado.error}</Aviso>)}
      <input type="hidden" name="clave" value={clave} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          Nombre en Meta <span className="text-tinta-suave">(vacío = no se envía sola)</span>
          <input name="metaNombre" defaultValue={valores.metaNombre} placeholder="recordatorio_cita" className={campo} />
        </label>
        <label className="block">
          Categoría
          <select name="metaCategoria" defaultValue={valores.metaCategoria || "utility"} className={campo}>
            {CATEGORIAS_META.map((c) => (
              <option key={c} value={c}>
                {NOMBRE_CATEGORIA_META[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Variables, en orden ({"{{1}}"}, {"{{2}}"}…)
          <input name="metaVariables" defaultValue={valores.metaVariables} placeholder="nombre, fecha, hora" className={campo} />
        </label>
        <label className="block">
          Idioma
          <input name="metaIdioma" defaultValue={valores.metaIdioma} className={campo} />
        </label>
      </div>
      <label className="flex min-h-toque items-center gap-3">
        <input type="checkbox" name="metaBotones" defaultChecked={valores.metaBotones} className="size-6 accent-dorado-oscuro" />
        Lleva los botones «Confirmar» y «Cambiar cita»
      </label>
      <Boton type="submit" variante="secundario" disabled={pendiente}>
        Guardar datos de Meta
      </Boton>
    </form>
  );
}

const hora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function FormularioAutomatico({ valores }: { valores: { recordatorios: boolean; seguimiento: boolean; desde: number; hasta: number } }) {
  const [estado, accion, pendiente] = useActionState(guardarAutomatico, null);
  return (
    <form onSubmit={sinReinicio(accion)} className="space-y-3" aria-label="Envío automático">
      {estado && (estado.ok ? <Aviso prioridad="correcto">{estado.mensaje}</Aviso> : <Aviso prioridad="urgente">{estado.error}</Aviso>)}
      <label className="flex min-h-toque items-start gap-3">
        <input type="checkbox" name="recordatorios" defaultChecked={valores.recordatorios} className="mt-1 size-6 accent-dorado-oscuro" />
        <span>
          <strong>Recordatorios</strong>: enviar solos, el día antes, a las clientas con permiso para avisos de citas. Pueden confirmar con un botón.
        </span>
      </label>
      <label className="flex min-h-toque items-start gap-3">
        <input type="checkbox" name="seguimiento" defaultChecked={valores.seguimiento} className="mt-1 size-6 accent-dorado-oscuro" />
        <span>
          <strong>Qué tal</strong>: enviar solo, el día después del tratamiento.
        </span>
      </label>
      <div className="flex flex-wrap gap-3">
        <label className="block w-40">
          Enviar desde las
          <input name="desde" type="time" defaultValue={hora(valores.desde)} className={campo} />
        </label>
        <label className="block w-40">
          hasta las
          <input name="hasta" type="time" defaultValue={hora(valores.hasta)} className={campo} />
        </label>
      </div>
      <Boton type="submit" disabled={pendiente}>
        Guardar
      </Boton>
    </form>
  );
}
