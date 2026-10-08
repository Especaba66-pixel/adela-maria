"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { nota } from "../acciones";

export function NuevaNota({ id }: { id: string }) {
  const [estado, accion, pendiente] = useActionState(nota, {});
  return (
    <form action={accion} className="space-y-2">
      {estado.error && <Aviso prioridad="urgente">{estado.error}</Aviso>}
      <input type="hidden" name="id" value={id} />
      <textarea
        name="texto"
        rows={2}
        maxLength={2000}
        required
        aria-label="Nueva nota"
        placeholder="Añadir una nota a su historial…"
        className="block w-full rounded-xl border-2 border-borde bg-superficie px-3 py-2 text-lg"
      />
      <Boton type="submit" variante="secundario" disabled={pendiente}>
        Añadir nota
      </Boton>
    </form>
  );
}
