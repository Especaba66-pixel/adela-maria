"use client";
import { METODOS_CAJA, NOMBRE_METODO, formatearEuros } from "@adela/dominio";
import { Aviso, Boton } from "@adela/ui";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { sinReinicio } from "@/components/sinReinicio";
import { reimprimirVale } from "../../acciones";
import { devolverTarjeta } from "./acciones";

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg";

export function BotonesVale({ tarjetaId, whatsapp }: { tarjetaId: string; whatsapp: string }) {
  const [estado, setEstado] = useState<{ ok?: string; error?: string }>({});
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Link href="/gestion/tpv" className="inline-flex min-h-boton items-center rounded-xl bg-dorado-oscuro px-6 text-xl font-semibold text-white hover:bg-tinta">
          Nuevo cobro
        </Link>
        <Boton variante="secundario" disabled={pendiente} onClick={() => iniciar(async () => setEstado(await reimprimirVale(tarjetaId)))}>
          Reimprimir vale
        </Boton>
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-toque items-center rounded-xl border-2 border-correcto px-5 font-semibold text-correcto hover:bg-correcto-fondo">
          Enviar por WhatsApp
        </a>
      </div>
      {estado.ok && <Aviso prioridad="correcto">{estado.ok}</Aviso>}
      {estado.error && <Aviso prioridad="urgente">{estado.error}</Aviso>}
    </div>
  );
}

export function DevolverTarjeta({ tarjetaId, importe }: { tarjetaId: string; importe: number }) {
  const [estado, accion, pendiente] = useActionState(devolverTarjeta, {});
  return (
    <details>
      <summary className="inline-flex min-h-toque cursor-pointer items-center font-semibold text-urgente">Devolver esta tarjeta…</summary>
      <form onSubmit={sinReinicio(accion)} className="mt-3 space-y-3 rounded-xl border border-urgente bg-urgente-fondo p-4">
        {estado.error && <Aviso prioridad="urgente">{estado.error}</Aviso>}
        <p>Se devolverán {formatearEuros(importe)} y la tarjeta dejará de valer. Solo se puede si no se ha usado.</p>
        <input type="hidden" name="tarjeta" value={tarjetaId} />
        <label className="block">
          Cómo se devuelve el dinero
          <select name="metodo" className={campo}>
            {METODOS_CAJA.map((m) => (
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
          Devolver la tarjeta
        </Boton>
      </form>
    </details>
  );
}
