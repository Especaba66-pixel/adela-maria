"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState, useState } from "react";
import type { ConfigImpresora } from "@/server/impresora";
import { cajon, guardar, prueba } from "./acciones";
import { sinReinicio } from "@/components/sinReinicio";

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg";

function Mensaje({ e }: { e: { ok?: string; error?: string } }) {
  if (e.error) return <Aviso prioridad="urgente">{e.error}</Aviso>;
  if (e.ok) return <Aviso prioridad="correcto">{e.ok}</Aviso>;
  return null;
}

export function FormularioImpresora({ config }: { config: ConfigImpresora }) {
  const [estado, accion, pendiente] = useActionState(guardar, {});
  const [estadoPrueba, accionPrueba, probando] = useActionState(prueba, {});
  const [estadoCajon, accionCajon, abriendo] = useActionState(cajon, {});
  const [tipo, setTipo] = useState(config.tipo);
  return (
    <div className="space-y-6">
      <form onSubmit={sinReinicio(accion)} className="space-y-4">
        <Mensaje e={estado} />
        <label className="block font-medium">
          Cómo está conectada
          <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as ConfigImpresora["tipo"])} className={campo}>
            <option value="ninguna">Sin impresora (ticket en pantalla y por WhatsApp)</option>
            <option value="windows">Por USB, instalada en Windows</option>
            <option value="red">Por cable de red o wifi</option>
            <option value="simulador">Simulador (para probar sin impresora)</option>
          </select>
        </label>
        {tipo === "windows" && (
          <label className="block font-medium">
            Nombre de la impresora compartida en Windows
            <input name="nombre" defaultValue={config.nombre} placeholder="TICKETS" className={campo} />
          </label>
        )}
        {tipo === "red" && (
          <div className="grid grid-cols-3 gap-3">
            <label className="col-span-2 block font-medium">
              Dirección IP
              <input name="host" defaultValue={config.host} placeholder="192.168.1.50" className={campo} />
            </label>
            <label className="block font-medium">
              Puerto
              <input name="puerto" inputMode="numeric" defaultValue={config.puerto ?? 9100} className={campo} />
            </label>
          </div>
        )}
        <label className="block font-medium">
          Ancho del papel
          <select name="ancho" defaultValue={String(config.ancho ?? 48)} className={campo}>
            <option value="48">80 mm (el más habitual)</option>
            <option value="32">58 mm</option>
          </select>
        </label>
        <Boton type="submit" disabled={pendiente}>
          Guardar
        </Boton>
      </form>
      <div className="flex flex-wrap gap-3 border-t border-borde pt-4">
        <form action={accionPrueba}>
          <Boton type="submit" variante="secundario" disabled={probando}>
            Imprimir prueba
          </Boton>
        </form>
        <form action={accionCajon}>
          <Boton type="submit" variante="secundario" disabled={abriendo}>
            Abrir cajón
          </Boton>
        </form>
      </div>
      <Mensaje e={estadoPrueba} />
      <Mensaje e={estadoCajon} />
    </div>
  );
}
