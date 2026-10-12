"use client";
import { METODOS_PAGO, NOMBRE_METODO, formatearEuros } from "@adela/dominio";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { devolver } from "./acciones";
import { sinReinicio } from "@/components/sinReinicio";

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg";

export function Devolver({ facturaId, total }: { facturaId: string; total: number }) {
  const [estado, accion, pendiente] = useActionState(devolver, {});
  return (
    <details>
      <summary className="inline-flex min-h-toque cursor-pointer items-center font-semibold text-urgente">Devolver esta venta…</summary>
      <form onSubmit={sinReinicio(accion)} className="mt-3 space-y-3 rounded-xl border border-urgente bg-urgente-fondo p-4">
        {estado.error && <Aviso prioridad="urgente">{estado.error}</Aviso>}
        <p>Se emitirá una factura rectificativa de {formatearEuros(-total)} y se devolverá lo pagado. La factura original no se borra.</p>
        <input type="hidden" name="factura" value={facturaId} />
        <label className="block">
          Cómo se devuelve el dinero
          <select name="metodo" className={campo}>
            {METODOS_PAGO.map((m) => (
              <option key={m} value={m}>
                {NOMBRE_METODO[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Motivo
          <input name="motivo" required className={campo} />
        </label>
        <Boton type="submit" variante="peligro" disabled={pendiente}>
          Hacer la devolución
        </Boton>
      </form>
    </details>
  );
}
