import { NOMBRE_ESTADO, type EstadoCita } from "@adela/dominio";
import { clases } from "@adela/ui";

const COLOR: Record<EstadoCita, string> = {
  pendiente: "bg-pendiente-fondo text-pendiente border-pendiente",
  confirmada: "bg-informativo-fondo text-informativo border-informativo",
  realizada: "bg-correcto-fondo text-correcto border-correcto",
  no_presentada: "bg-urgente-fondo text-urgente border-urgente",
  cancelada: "bg-crema text-tinta-suave border-borde line-through",
};

export function EstadoCitaChip({ estado }: { estado: EstadoCita }) {
  return <span className={clases("inline-block rounded-full border px-3 py-0.5 text-sm font-medium", COLOR[estado])}>{NOMBRE_ESTADO[estado]}</span>;
}

/** Borde izquierdo de la tarjeta de cita según el estado. */
export const BORDE_ESTADO: Record<EstadoCita, string> = {
  pendiente: "border-l-pendiente",
  confirmada: "border-l-informativo",
  realizada: "border-l-correcto",
  no_presentada: "border-l-urgente",
  cancelada: "border-l-borde opacity-60",
};
