"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { crear, editar } from "./acciones";

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg focus:border-dorado";

export interface ValoresClienta {
  id?: string;
  nombre: string;
  telefono: string;
  email: string;
  fechaNacimiento: string;
  notas: string;
  aceptaAvisosCitas: boolean;
  aceptaPromociones: boolean;
}

export function FormularioClienta({ valores }: { valores?: ValoresClienta }) {
  const [estado, accion, pendiente] = useActionState(valores?.id ? editar : crear, {});
  return (
    <form action={accion} className="space-y-4">
      {estado.error && <Aviso prioridad="urgente">{estado.error}</Aviso>}
      {estado.ok && <Aviso prioridad="correcto">{estado.ok}</Aviso>}
      {valores?.id && <input type="hidden" name="id" value={valores.id} />}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          Nombre
          <input name="nombre" required defaultValue={valores?.nombre} className={campo} />
        </label>
        <label className="block">
          Teléfono
          <input name="telefono" type="tel" defaultValue={valores?.telefono} className={campo} />
        </label>
        <label className="block">
          Correo <span className="text-tinta-suave">(opcional)</span>
          <input name="email" type="email" defaultValue={valores?.email} className={campo} />
        </label>
        <label className="block">
          Cumpleaños <span className="text-tinta-suave">(opcional)</span>
          <input name="fechaNacimiento" type="date" defaultValue={valores?.fechaNacimiento} className={campo} />
        </label>
        <label className="col-span-2 block">
          Notas fijas <span className="text-tinta-suave">(preferencias; nada de salud aquí)</span>
          <textarea name="notas" rows={2} maxLength={2000} defaultValue={valores?.notas} className={`${campo} py-2`} />
        </label>
      </div>
      <fieldset className="space-y-1">
        <legend className="font-medium">Permisos de WhatsApp</legend>
        <label className="flex min-h-toque items-center gap-3">
          <input name="aceptaAvisosCitas" type="checkbox" defaultChecked={valores?.aceptaAvisosCitas} className="size-6 accent-dorado-oscuro" />
          Avisos de sus citas (recordatorios, cambios)
        </label>
        <label className="flex min-h-toque items-center gap-3">
          <input name="aceptaPromociones" type="checkbox" defaultChecked={valores?.aceptaPromociones} className="size-6 accent-dorado-oscuro" />
          Promociones y novedades
        </label>
      </fieldset>
      <Boton type="submit" disabled={pendiente}>
        {valores?.id ? "Guardar ficha" : "Crear clienta"}
      </Boton>
    </form>
  );
}
