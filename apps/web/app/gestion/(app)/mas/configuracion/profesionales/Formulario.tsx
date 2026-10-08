"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { guardar } from "./acciones";

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg";

export function FormularioProfesional({
  valores,
  usuarios,
  tratamientos,
}: {
  valores?: { id: string; nombre: string; color: string; usuarioId: string | null; activo: boolean; tratamientoIds: string[] };
  usuarios: { id: string; nombre: string }[];
  tratamientos: { id: string; nombre: string; categoria: string }[];
}) {
  const [estado, accion, pendiente] = useActionState(guardar, null);
  const categorias = [...new Set(tratamientos.map((t) => t.categoria))];
  return (
    <form action={accion} className="space-y-4">
      {estado && (estado.ok ? <Aviso prioridad="correcto">{estado.mensaje}</Aviso> : <Aviso prioridad="urgente">{estado.error}</Aviso>)}
      {valores && <input type="hidden" name="id" value={valores.id} />}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          Nombre
          <input name="nombre" required defaultValue={valores?.nombre} className={campo} />
        </label>
        <label className="block">
          Color en la agenda
          <input name="color" type="color" defaultValue={valores?.color ?? "#b08d57"} className={`${campo} p-1`} />
        </label>
        <label className="block">
          Usuario que ve esta agenda
          <select name="usuario" defaultValue={valores?.usuarioId ?? ""} className={campo}>
            <option value="">Ninguno</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Estado
          <select name="activo" defaultValue={valores && !valores.activo ? "no" : "si"} className={campo}>
            <option value="si">Atiende citas</option>
            <option value="no">No atiende (oculta)</option>
          </select>
        </label>
      </div>
      <fieldset className="space-y-2">
        <legend className="font-medium">Qué tratamientos hace <span className="font-normal text-tinta-suave">(si no marcas ninguno, los hace todos)</span></legend>
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
        {valores ? "Guardar" : "Añadir profesional"}
      </Boton>
    </form>
  );
}
