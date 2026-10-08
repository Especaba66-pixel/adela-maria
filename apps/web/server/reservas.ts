import "server-only";
import { categorias, registrarActividad, solicitudesReserva, tratamientos } from "@adela/db";
import { MAX_PENDIENTES_POR_TELEFONO, TEXTO_PRIVACIDAD, validarSolicitud, type DatosSolicitud } from "@adela/dominio";
import { and, asc, count, eq, gt, isNull } from "drizzle-orm";
import { requerirSesion } from "./auth";
import { db } from "./db";

/** Si llegan más peticiones que esto en 10 minutos, se frena (probable abuso). */
const MAX_PETICIONES_10_MIN = 20;

/** Tratamientos que se pueden reservar desde la web, con su categoría. */
export async function tratamientosReservables() {
  return db()
    .select({ id: tratamientos.id, nombre: tratamientos.nombre, categoria: categorias.nombre, precioCentimos: tratamientos.precioCentimos, duracionMinutos: tratamientos.duracionMinutos })
    .from(tratamientos)
    .innerJoin(categorias, eq(categorias.id, tratamientos.categoriaId))
    .where(and(isNull(tratamientos.anuladoEn), isNull(categorias.anuladoEn)))
    .orderBy(asc(categorias.orden), asc(tratamientos.orden));
}

export type ResultadoSolicitud = { ok: true } | { ok: false; error: string };

/** Petición de cita de una clienta. Pública: sin sesión ni clave. */
export async function crearSolicitud(datos: DatosSolicitud, trampa: string): Promise<ResultadoSolicitud> {
  // Campo oculto que solo rellenan los programas automáticos: se finge éxito y no se guarda nada.
  if (trampa) return { ok: true };

  const v = validarSolicitud(datos, new Date());
  if (!v.ok) return v;
  const s = v.datos;

  const [tratamiento] = await db()
    .select({ id: tratamientos.id })
    .from(tratamientos)
    .where(and(eq(tratamientos.id, s.tratamientoId), isNull(tratamientos.anuladoEn)));
  if (!tratamiento) return { ok: false, error: "Elige el tratamiento." };

  const [porTelefono] = await db()
    .select({ n: count() })
    .from(solicitudesReserva)
    .where(and(eq(solicitudesReserva.telefono, s.telefono), eq(solicitudesReserva.estado, "pendiente")));
  if (porTelefono!.n >= MAX_PENDIENTES_POR_TELEFONO) {
    return { ok: false, error: "Ya tienes varias peticiones pendientes. Te contestaremos enseguida; si es urgente, llámanos." };
  }
  const [recientes] = await db()
    .select({ n: count() })
    .from(solicitudesReserva)
    .where(gt(solicitudesReserva.creadaEn, new Date(Date.now() - 10 * 60_000)));
  if (recientes!.n >= MAX_PETICIONES_10_MIN) {
    return { ok: false, error: "Ahora mismo no podemos recibir más peticiones. Inténtalo en un rato o llámanos." };
  }

  await db().transaction(async (tx) => {
    const [nueva] = await tx.insert(solicitudesReserva).values({ ...s, consentimientoTexto: TEXTO_PRIVACIDAD }).returning({ id: solicitudesReserva.id });
    await registrarActividad(tx, { usuarioId: null, accion: "reserva.solicitar", entidad: "solicitudes_reserva", entidadId: nueva!.id });
  });
  return { ok: true };
}

export async function contarPendientes(): Promise<number> {
  const [r] = await db().select({ n: count() }).from(solicitudesReserva).where(eq(solicitudesReserva.estado, "pendiente"));
  return r!.n;
}

/** Confirmar o rechazar una petición. Solo personal con permiso de reservas. */
export async function gestionarSolicitud(id: string, estado: "confirmada" | "rechazada"): Promise<void> {
  const { usuario } = await requerirSesion("reservas.gestionar");
  await db().transaction(async (tx) => {
    const [actualizada] = await tx
      .update(solicitudesReserva)
      .set({ estado, gestionadaPor: usuario.id, gestionadaEn: new Date() })
      .where(and(eq(solicitudesReserva.id, id), eq(solicitudesReserva.estado, "pendiente")))
      .returning({ id: solicitudesReserva.id });
    if (!actualizada) return;
    await registrarActividad(tx, {
      usuarioId: usuario.id,
      accion: estado === "confirmada" ? "reserva.confirmar" : "reserva.rechazar",
      entidad: "solicitudes_reserva",
      entidadId: id,
      antes: { estado: "pendiente" },
      despues: { estado },
    });
  });
}
