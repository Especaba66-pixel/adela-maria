"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { sinReinicio } from "@/components/sinReinicio";
import { guardar } from "./acciones";

const campo = "mt-1 block w-full rounded-xl border-2 border-borde bg-superficie px-3 text-lg";

export function FormularioModelo({
  valores,
  tratamientos,
}: {
  valores?: { id: string; nombre: string; texto: string; activo: boolean; tratamientoIds: string[] };
  tratamientos: { id: string; nombre: string; categoria: string }[];
}) {
  const [estado, accion, pendiente] = useActionState(guardar, null);
  const categorias = [...new Set(tratamientos.map((t) => t.categoria))];
  return (
    <form key={!valores && estado?.ok ? Date.now() : "modelo"} onSubmit={sinReinicio(accion)} className="space-y-3" aria-label={valores ? `Consentimiento ${valores.nombre}` : "Nuevo consentimiento"}>
      {estado && (estado.ok ? <Aviso prioridad="correcto">{estado.mensaje}</Aviso> : <Aviso prioridad="urgente">{estado.error}</Aviso>)}
      {valores && <input type="hidden" name="id" value={valores.id} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <label className="block">
          Nombre
          <input name="nombre" required defaultValue={valores?.nombre} className={`${campo} min-h-toque`} />
        </label>
        <label className="block">
          Estado
          <select name="activo" defaultValue={valores && !valores.activo ? "no" : "si"} className={`${campo} min-h-toque`}>
            <option value="si">En uso</option>
            <option value="no">Retirado</option>
          </select>
        </label>
      </div>
      <label className="block">
        Texto <span className="text-tinta-suave">(puedes usar {"{nombre}"}, {"{fecha}"} y {"{centro}"})</span>
        <textarea name="texto" required rows={10} defaultValue={valores?.texto} className={`${campo} py-2`} />
      </label>
      <fieldset className="space-y-2">
        <legend className="font-medium">
          Hay que firmarlo antes de <span className="font-normal text-tinta-suave">(si no marcas ninguno, se firma cuando haga falta)</span>
        </legend>
        {categorias.map((c) => (
          <div key={c} className="flex flex-wrap gap-x-5 gap-y-1">
            <span className="w-full text-sm font-semibold uppercase tracking-wider text-tinta-suave">{c}</span>
            {tratamientos
              .filter((t) => t.categoria === c)
              .map((t) => (
                <label key={t.id} className="flex min-h-toque items-center gap-2">
                  <input type="checkbox" name="tratamiento" value={t.id} defaultChecked={valores?.tratamientoIds.includes(t.id)} className="size-5 accent-dorado-oscuro" />
                  {t.nombre}
                </label>
              ))}
          </div>
        ))}
      </fieldset>
      <Boton type="submit" disabled={pendiente}>
        {valores ? "Guardar" : "Añadir consentimiento"}
      </Boton>
    </form>
  );
}
