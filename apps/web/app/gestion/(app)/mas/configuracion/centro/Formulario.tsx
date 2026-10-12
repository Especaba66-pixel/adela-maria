"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { guardar } from "./acciones";
import { sinReinicio } from "@/components/sinReinicio";

const campo = "mt-2 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-4 text-lg focus:border-dorado";

export interface ValoresCentro {
  telefono: string;
  direccion: string;
  cabinas: number;
  nombreFiscal: string;
  nif: string;
  direccionFiscal: string;
  pieTicket: string;
}

export function Formulario({ telefono, direccion, cabinas, nombreFiscal, nif, direccionFiscal, pieTicket }: ValoresCentro) {
  const [estado, accion, pendiente] = useActionState(guardar, null);
  return (
    <form onSubmit={sinReinicio(accion)} className="space-y-5">
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
      <fieldset className="space-y-4 rounded-xl border border-borde p-4">
        <legend className="px-2 font-semibold">Datos para las facturas</legend>
        <p className="text-sm text-tinta-suave">Salen en cada ticket y factura. Sin ellos no se puede cobrar.</p>
        <label className="block font-medium">
          Nombre fiscal (titular)
          <input name="nombreFiscal" defaultValue={nombreFiscal} maxLength={120} className={campo} />
        </label>
        <label className="block font-medium">
          NIF
          <input name="nif" defaultValue={nif} maxLength={12} autoCapitalize="characters" className={campo} />
        </label>
        <label className="block font-medium">
          Dirección fiscal
          <input name="direccionFiscal" defaultValue={direccionFiscal} maxLength={200} className={campo} />
        </label>
        <label className="block font-medium">
          Mensaje al pie del ticket <span className="font-normal text-tinta-suave">(opcional)</span>
          <input name="pieTicket" defaultValue={pieTicket} maxLength={200} placeholder="¡Gracias por tu visita!" className={campo} />
        </label>
      </fieldset>
      <Boton type="submit" disabled={pendiente}>
        Guardar
      </Boton>
    </form>
  );
}
