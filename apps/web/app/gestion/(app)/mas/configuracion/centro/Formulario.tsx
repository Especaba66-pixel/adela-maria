"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { guardar } from "./acciones";

const campo = "mt-2 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-4 text-lg focus:border-dorado";

export function Formulario({ telefono, direccion, cabinas }: { telefono: string; direccion: string; cabinas: number }) {
  const [estado, accion, pendiente] = useActionState(guardar, null);
  return (
    <form action={accion} className="space-y-5">
      {estado && (estado.ok ? <Aviso prioridad="correcto">{estado.mensaje}</Aviso> : <Aviso prioridad="urgente">{estado.error}</Aviso>)}
      <label className="block font-medium">
        Teléfono y WhatsApp del centro
        <input name="telefono" type="tel" inputMode="tel" defaultValue={telefono} className={campo} />
        <span className="mt-1 block text-sm font-normal text-tinta-suave">
          El número del centro, no uno personal. Si es un móvil, la web muestra también «Escríbenos por WhatsApp».
        </span>
      </label>
      <label className="block font-medium">
        Dirección
        <input name="direccion" defaultValue={direccion} maxLength={200} className={campo} />
      </label>
      <label className="block font-medium">
        Número de cabinas
        <input name="cabinas" type="number" min={1} max={20} required defaultValue={cabinas} className={campo} />
        <span className="mt-1 block text-sm font-normal text-tinta-suave">
          Cuántas citas puede haber a la vez. Los tratamientos marcados «va sola» (como el microblading) no admiten nada a la vez.
        </span>
      </label>
      <Boton type="submit" disabled={pendiente}>
        Guardar
      </Boton>
    </form>
  );
}
