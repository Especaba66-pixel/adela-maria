import "server-only";
import { categorias, citas, clientes, consentimientos, registrarActividad, solicitudesReserva, tratamientos } from "@adela/db";
import {
  MAX_PENDIENTES_POR_TELEFONO,
  TEXTO_PRIVACIDAD,
  esFecha,
  normalizarTelefono,
  rangoFechasReserva,
  validarSolicitud,
  type DatosSolicitud,
} from "@adela/dominio";
import { and, asc, count, eq, gt, isNull } from "drizzle-orm";
import { crearCitas, huecosWeb } from "./agenda";
import { requerirSesion } from "./auth";
import { db } from "./db";

/** Si llegan más peticiones que esto en 10 minutos, se frena (probable abuso). */
const MAX_PETICIONES_10_MIN = 20;

/** Tratamientos que se pueden reservar desde la web, con su categoría. */
export async function tratamientosReservables() {
  return db()
    .select({
      id: tratamientos.id,
      nombre: tratamientos.nombre,
      descripcion: tratamientos.descripcion,
      categoria: categorias.nombre,
      precioCentimos: tratamientos.precioCentimos,
      duracionMinutos: tratamientos.duracionMinutos,
    })
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

/** Peticiones sin contestar: citas web por confirmar y peticiones sin hora. */
export async function contarPendientes(): Promise<number> {
  const [[s], [c]] = await Promise.all([
    db().select({ n: count() }).from(solicitudesReserva).where(eq(solicitudesReserva.estado, "pendiente")),
    db().select({ n: count() }).from(citas).where(eq(citas.estado, "pendiente")),
  ]);
  return s!.n + c!.n;
}

/** Peticiones pendientes de un teléfono (citas por confirmar + peticiones sin hora). */
async function pendientesDeTelefono(telefono: string): Promise<number> {
  const [[s], [c]] = await Promise.all([
    db()
      .select({ n: count() })
      .from(solicitudesReserva)
      .where(and(eq(solicitudesReserva.telefono, telefono), eq(solicitudesReserva.estado, "pendiente"))),
    db()
      .select({ n: count() })
      .from(citas)
      .innerJoin(clientes, eq(clientes.id, citas.clienteId))
      .where(and(eq(clientes.telefono, telefono), eq(citas.estado, "pendiente"))),
  ]);
  return s!.n + c!.n;
}

/**
 * Cita pedida desde la web con hora concreta. Pública: sin sesión ni clave. Ocupa el hueco al momento
 * (nadie más puede cogerlo) y queda «por confirmar» hasta que el centro la confirme.
 */
export async function reservarConHora(
  datos: { tratamientoId: string; fecha: string; minutos: number; nombre: string; telefono: string; nota: string; aceptaPrivacidad: boolean },
  trampa: string,
): Promise<ResultadoSolicitud> {
  if (trampa) return { ok: true };
  // Se reutilizan las reglas de la petición (nombre, teléfono, fecha, privacidad).
  const v = validarSolicitud({ ...datos, fechaPreferida: datos.fecha, franja: "indiferente" }, new Date());
  if (!v.ok) return v;
  const { nombre, telefono, nota } = v.datos;
  const { desde, hasta } = rangoFechasReserva(new Date());
  if (!esFecha(datos.fecha) || datos.fecha < desde || datos.fecha > hasta) return { ok: false, error: "Elige otro día." };

  const libre = (await huecosWeb(datos.tratamientoId, datos.fecha)).find((h) => h.minutos === datos.minutos);
  if (!libre) return { ok: false, error: "Esa hora acaba de ocuparse. Elige otra, por favor." };
  if ((await pendientesDeTelefono(telefono)) >= MAX_PENDIENTES_POR_TELEFONO) {
    return { ok: false, error: "Ya tienes varias citas por confirmar. Te contestaremos enseguida; si es urgente, llámanos." };
  }

  try {
    await db().transaction(async (tx) => {
      let [cliente] = await tx.select().from(clientes).where(and(eq(clientes.telefono, telefono), isNull(clientes.anonimizadaEn)));
      if (!cliente) {
        [cliente] = await tx.insert(clientes).values({ nombre, telefono }).returning();
        await registrarActividad(tx, { usuarioId: null, accion: "clienta.crear", entidad: "clientes", entidadId: cliente!.id, despues: { origen: "web" } });
      }
      await tx.insert(consentimientos).values({ clienteId: cliente!.id, tipo: "privacidad_reserva", aceptado: true, texto: TEXTO_PRIVACIDAD, canal: "web" });
      const r = await crearCitas(
        {
          clienteId: cliente!.id,
          profesionalId: libre.profesionalId,
          fecha: datos.fecha,
          inicioMin: datos.minutos,
          tratamientoIds: [datos.tratamientoId],
          nota: nombre === cliente!.nombre ? nota : [`Nombre dado en la web: ${nombre}`, nota].filter(Boolean).join(". "),
          estado: "pendiente",
          origen: "web",
        },
        null,
        tx,
      );
      if (!r.ok) throw new ReservaFallida(r.error);
    });
  } catch (e) {
    if (e instanceof ReservaFallida) return { ok: false, error: "Esa hora acaba de ocuparse. Elige otra, por favor." };
    throw e;
  }
  return { ok: true };
}

class ReservaFallida extends Error {}

export { normalizarTelefono };

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
