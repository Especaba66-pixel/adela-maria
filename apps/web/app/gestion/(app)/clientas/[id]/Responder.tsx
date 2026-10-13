"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { responder } from "@/app/gestion/(app)/mas/whatsapp/acciones";
import { sinReinicio } from "@/components/sinReinicio";

/** Contestar a la clienta por WhatsApp (texto libre, en las 24 horas siguientes a su último mensaje). */
export function Responder({ clienteId }: { clienteId: string }) {
  const [estado, accion, pendiente] = useActionState(responder, null);
  return (
    <form key={estado?.ok ? Date.now() : "responder"} onSubmit={sinReinicio(accion)} className="space-y-2" aria-label="Responder por WhatsApp">
      {estado && !estado.ok && <Aviso prioridad="urgente">{estado.error}</Aviso>}
      <input type="hidden" name="cliente" value={clienteId} />
      <textarea name="texto" rows={2} required maxLength={4000} aria-label="Respuesta" placeholder="Escribe tu respuesta…" className="block w-full rounded-xl border-2 border-borde bg-superficie px-3 py-2 text-lg" />
      <Boton type="submit" variante="secundario" disabled={pendiente}>
        Responder
      </Boton>
    </form>
  );
}
