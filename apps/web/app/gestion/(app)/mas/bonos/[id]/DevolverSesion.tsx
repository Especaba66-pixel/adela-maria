"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { sinReinicio } from "@/components/sinReinicio";
import { devolverSesion } from "./acciones";

export function DevolverSesion({ bonoId }: { bonoId: string }) {
  const [estado, accion, pendiente] = useActionState(devolverSesion, {});
  return (
    <details>
      <summary className="inline-flex min-h-toque cursor-pointer items-center font-semibold text-urgente">Devolver una sesión al bono…</summary>
      <form onSubmit={sinReinicio(accion)} className="mt-3 space-y-3 rounded-xl border border-urgente bg-urgente-fondo p-4">
        {estado.error && <Aviso prioridad="urgente">{estado.error}</Aviso>}
        <p>Por si se descontó por error. Queda anotado quién lo hizo y por qué; la sesión gastada no se borra.</p>
        <input type="hidden" name="bono" value={bonoId} />
        <label className="block">
          Motivo
          <input name="motivo" required className="mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg" />
        </label>
        <Boton type="submit" variante="peligro" disabled={pendiente}>
          Devolver la sesión
        </Boton>
      </form>
    </details>
  );
}
