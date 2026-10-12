"use client";
import { Aviso, Boton } from "@adela/ui";
import Link from "next/link";
import { useState, useTransition } from "react";
import { reimprimir } from "../../acciones";

export function BotonesTicket({ facturaId, whatsapp }: { facturaId: string; whatsapp: string }) {
  const [estado, setEstado] = useState<{ ok?: string; error?: string }>({});
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Link href="/gestion/tpv" className="inline-flex min-h-boton items-center rounded-xl bg-dorado-oscuro px-6 text-xl font-semibold text-white hover:bg-tinta">
          Nuevo cobro
        </Link>
        <Boton variante="secundario" disabled={pendiente} onClick={() => iniciar(async () => setEstado(await reimprimir(facturaId)))}>
          Reimprimir
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
