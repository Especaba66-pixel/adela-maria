"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { sinReinicio } from "@/components/sinReinicio";
import { guardarPlantilla } from "./acciones";

export function FormularioPlantilla({ clave, nombre, texto, ejemplo }: { clave: string; nombre: string; texto: string; ejemplo: string }) {
  const [estado, accion, pendiente] = useActionState(guardarPlantilla, null);
  return (
    <form onSubmit={sinReinicio(accion)} className="space-y-2" aria-label={nombre}>
      {estado && (estado.ok ? <Aviso prioridad="correcto">{estado.mensaje}</Aviso> : <Aviso prioridad="urgente">{estado.error}</Aviso>)}
      <input type="hidden" name="clave" value={clave} />
      <textarea name="texto" rows={3} defaultValue={texto} aria-label={`Texto de «${nombre}»`} className="block w-full rounded-xl border-2 border-borde bg-superficie px-3 py-2 text-lg" />
      <p className="text-sm text-tinta-suave">Así queda: {ejemplo}</p>
      <Boton type="submit" variante="secundario" disabled={pendiente}>
        Guardar
      </Boton>
    </form>
  );
}
