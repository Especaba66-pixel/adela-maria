"use client";
import { TEXTO_PRIVACIDAD } from "@adela/dominio";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { reservarCita } from "./acciones";

const campo = "mt-2 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-4 text-lg focus:border-dorado";

/** Último paso de la reserva con hora: datos de la clienta. */
export function FormularioDatos({ tratamiento, fecha, hora }: { tratamiento: string; fecha: string; hora: number }) {
  const [estado, accion, pendiente] = useActionState(reservarCita, {});
  return (
    <form action={accion} className="space-y-6">
      {estado.error && <Aviso prioridad="urgente">{estado.error}</Aviso>}
      <input type="hidden" name="tratamiento" value={tratamiento} />
      <input type="hidden" name="fecha" value={fecha} />
      <input type="hidden" name="hora" value={hora} />
      <label className="block font-medium">
        Tu nombre
        <input name="nombre" autoComplete="name" required maxLength={80} className={campo} />
      </label>
      <label className="block font-medium">
        Tu teléfono (para confirmarte por WhatsApp)
        <input name="telefono" type="tel" autoComplete="tel" inputMode="tel" required className={campo} />
      </label>
      <label className="block font-medium">
        Comentario <span className="font-normal text-tinta-suave">(opcional)</span>
        <textarea name="nota" rows={3} maxLength={500} className={`${campo} py-3`} />
      </label>
      <div aria-hidden className="absolute left-[-10000px]">
        <label>
          No rellenar
          <input name="web" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="flex items-start gap-3 text-tinta-suave">
        <input name="privacidad" type="checkbox" required className="mt-1 size-6 shrink-0 accent-dorado-oscuro" />
        <span>{TEXTO_PRIVACIDAD}</span>
      </label>
      <Boton type="submit" grande disabled={pendiente} className="w-full">
        {pendiente ? "Reservando…" : "Reservar esta hora"}
      </Boton>
    </form>
  );
}
