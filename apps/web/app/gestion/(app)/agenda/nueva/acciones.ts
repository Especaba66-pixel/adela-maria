"use server";
import { clientes, registrarActividad, solicitudesReserva } from "@adela/db";
import { textoAHora } from "@adela/dominio";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { crearCitas, huecosProfesional } from "@/server/agenda";
import { requerirSesion } from "@/server/auth";
import { buscarClientas, crearClienta } from "@/server/clientas";
import { db } from "@/server/db";

export async function buscar(texto: string) {
  const lista = await buscarClientas(texto, 8);
  return lista.map((c) => ({ id: c.id, nombre: c.nombre, telefono: c.telefono }));
}

export async function huecos(profesionalId: string, fecha: string, duracion: number) {
  await requerirSesion("agenda.gestionar");
  return huecosProfesional(profesionalId, fecha, duracion);
}

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function guardarCita(_: { error?: string }, f: FormData): Promise<{ error?: string }> {
  const { usuario } = await requerirSesion("agenda.gestionar");

  let clienteId = texto(f, "cliente");
  if (!clienteId) {
    const nueva = await crearClienta({
      nombre: texto(f, "nuevoNombre"),
      telefono: texto(f, "nuevoTelefono"),
      email: "",
      fechaNacimiento: "",
      notas: "",
      aceptaAvisosCitas: f.get("nuevoAvisos") === "on",
      aceptaPromociones: false,
    });
    if (!nueva.ok) return { error: nueva.error };
    clienteId = nueva.valor;
  }
  const [cliente] = await db().select({ id: clientes.id }).from(clientes).where(eq(clientes.id, clienteId));
  if (!cliente) return { error: "Elige la clienta." };

  const inicioMin = textoAHora(texto(f, "hora"));
  if (inicioMin === null) return { error: "Elige la hora." };
  const veces = Number(texto(f, "veces") || "1");
  const cadaSemanas = Number(texto(f, "cadaSemanas") || "1");
  const solicitudId = texto(f, "solicitud") || undefined;

  const r = await crearCitas(
    {
      clienteId,
      profesionalId: texto(f, "profesional"),
      fecha: texto(f, "fecha"),
      inicioMin,
      tratamientoIds: f.getAll("tratamiento").map(String),
      nota: texto(f, "nota") || null,
      estado: "confirmada",
      origen: "centro",
      repetir: { cadaSemanas, veces },
      solicitudId,
    },
    usuario.id,
  );
  if (!r.ok) return { error: r.error };

  if (solicitudId) {
    const [s] = await db()
      .update(solicitudesReserva)
      .set({ estado: "confirmada", gestionadaPor: usuario.id, gestionadaEn: new Date() })
      .where(and(eq(solicitudesReserva.id, solicitudId), eq(solicitudesReserva.estado, "pendiente")))
      .returning({ id: solicitudesReserva.id });
    if (s) await registrarActividad(db(), { usuarioId: usuario.id, accion: "reserva.confirmar", entidad: "solicitudes_reserva", entidadId: s.id, despues: { cita: r.valor[0] } });
  }
  redirect(`/gestion/agenda/cita/${r.valor[0]}?creada=${r.valor.length}`);
}
