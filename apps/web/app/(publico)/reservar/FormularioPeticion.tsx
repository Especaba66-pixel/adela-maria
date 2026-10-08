"use client";
import { FRANJAS, NOMBRE_FRANJA, TEXTO_PRIVACIDAD } from "@adela/dominio";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { pedirCita } from "./acciones";

interface Opcion {
  id: string;
  nombre: string;
  categoria: string;
}

const campo = "mt-2 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-4 text-lg focus:border-dorado";

export function FormularioPeticion({ tratamientos, elegido, desde, hasta }: { tratamientos: Opcion[]; elegido?: string; desde: string; hasta: string }) {
  const [estado, accion, pendiente] = useActionState(pedirCita, {});
  const categorias = [...new Set(tratamientos.map((t) => t.categoria))];
  return (
    <form action={accion} className="space-y-6">
      {estado.error && <Aviso prioridad="urgente">{estado.error}</Aviso>}

      <label className="block font-medium">
        Tratamiento
        <select name="tratamiento" required defaultValue={elegido ?? ""} className={campo}>
          <option value="" disabled>
            Elige…
          </option>
          {categorias.map((c) => (
            <optgroup key={c} label={c}>
              {tratamientos
                .filter((t) => t.categoria === c)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="block font-medium">
        ¿Qué día te viene bien?
        <input name="fecha" type="date" required min={desde} max={hasta} className={campo} />
      </label>

      <fieldset>
        <legend className="font-medium">¿A qué hora, más o menos?</legend>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {FRANJAS.map((f, i) => (
            <label
              key={f}
              className="flex min-h-toque cursor-pointer items-center justify-center rounded-xl border-2 border-borde px-2 text-center has-checked:border-dorado-oscuro has-checked:bg-crema has-checked:font-semibold"
            >
              <input type="radio" name="franja" value={f} required defaultChecked={i === 2} className="sr-only" />
              {NOMBRE_FRANJA[f]}
            </label>
          ))}
        </div>
      </fieldset>

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

      {/* Campo trampa para programas automáticos: las personas no lo ven. */}
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
        {pendiente ? "Enviando…" : "Pedir cita"}
      </Boton>
    </form>
  );
}
