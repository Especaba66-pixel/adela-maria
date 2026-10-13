"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { enviarCampana } from "../acciones";

export function EnviarCampana({ segmento, plantilla, total }: { segmento: string; plantilla: string; total: number }) {
  const [estado, accion, pendiente] = useActionState(enviarCampana, null);
  return (
    <form action={accion} className="space-y-3" aria-label="Enviar al grupo">
      {estado && (estado.ok ? <Aviso prioridad="correcto">{estado.mensaje}</Aviso> : <Aviso prioridad="urgente">{estado.error}</Aviso>)}
      <input type="hidden" name="segmento" value={segmento} />
      <input type="hidden" name="plantilla" value={plantilla} />
      {!estado?.ok && (
        <Boton type="submit" disabled={pendiente || total === 0}>
          {pendiente ? "Enviando…" : `Enviar a ${total} ${total === 1 ? "clienta" : "clientas"}`}
        </Boton>
      )}
    </form>
  );
}
