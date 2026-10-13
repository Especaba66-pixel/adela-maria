"use client";
import { useActionState } from "react";
import { enviarMensaje } from "@/app/gestion/(app)/mas/whatsapp/acciones";

/** Botón que envía por la API un mensaje aprobado y dice si ha ido bien. */
export function EnviarWhatsapp({
  clienteId,
  plantilla,
  citaId,
  bonoId,
  clave,
  texto = "Enviar WhatsApp",
  className,
}: {
  clienteId: string;
  plantilla: string;
  citaId?: string;
  bonoId?: string;
  clave?: string;
  texto?: string;
  className?: string;
}) {
  const [estado, accion, pendiente] = useActionState(enviarMensaje, null);
  return (
    <form action={accion} className="inline-flex flex-col">
      <input type="hidden" name="cliente" value={clienteId} />
      <input type="hidden" name="plantilla" value={plantilla} />
      {citaId && <input type="hidden" name="cita" value={citaId} />}
      {bonoId && <input type="hidden" name="bono" value={bonoId} />}
      {clave && <input type="hidden" name="clave" value={clave} />}
      <button type="submit" disabled={pendiente || estado?.ok === true} className={className ?? "inline-flex min-h-10 items-center rounded-lg bg-correcto px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"}>
        {pendiente ? "Enviando…" : estado?.ok ? "Enviado ✓" : texto}
      </button>
      {estado && !estado.ok && (
        <span role="alert" className="mt-1 max-w-xs text-sm text-urgente">
          {estado.error}
        </span>
      )}
    </form>
  );
}
