import { clientes, solicitudesReserva } from "@adela/db";
import { esFecha, horaATexto, hoyEnMadrid } from "@adela/dominio";
import { eq } from "drizzle-orm";
import { catalogoParaCitas, equipoConTratamientos } from "@/server/agenda";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { FormularioCita, type Inicial } from "./FormularioCita";

export default async function NuevaCita({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; hora?: string; profesional?: string; cliente?: string; solicitud?: string }>;
}) {
  await requerirSesion("agenda.gestionar");
  const p = await searchParams;
  const [tratamientos, equipo] = await Promise.all([catalogoParaCitas(), equipoConTratamientos()]);
  const inicial: Inicial = {
    fecha: p.fecha && esFecha(p.fecha) ? p.fecha : hoyEnMadrid(new Date()),
    hora: p.hora && /^\d+$/.test(p.hora) ? horaATexto(Number(p.hora)) : undefined,
    profesionalId: equipo.some((e) => e.id === p.profesional) ? p.profesional : undefined,
  };
  if (p.cliente) {
    const [c] = await db().select().from(clientes).where(eq(clientes.id, p.cliente));
    if (c && !c.anonimizadaEn) inicial.clienta = { id: c.id, nombre: c.nombre, telefono: c.telefono };
  }
  // Dar cita a una petición hecha desde la web: se rellena con lo que pidió.
  if (p.solicitud) {
    const [s] = await db().select().from(solicitudesReserva).where(eq(solicitudesReserva.id, p.solicitud));
    if (s && s.estado === "pendiente") {
      const [existente] = await db().select().from(clientes).where(eq(clientes.telefono, s.telefono));
      if (existente && !existente.anonimizadaEn) inicial.clienta = { id: existente.id, nombre: existente.nombre, telefono: existente.telefono };
      else inicial.nuevaClienta = { nombre: s.nombre, telefono: s.telefono.replace(/^\+34/, "") };
      inicial.tratamientoIds = [s.tratamientoId];
      inicial.fecha = s.fechaPreferida;
      inicial.nota = s.nota ?? undefined;
      inicial.solicitudId = s.id;
    }
  }
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-4xl">Nueva cita</h1>
      {equipo.length === 0 ? <p>No hay profesionales activas.</p> : <FormularioCita tratamientos={tratamientos} equipo={equipo} inicial={inicial} />}
    </div>
  );
}
