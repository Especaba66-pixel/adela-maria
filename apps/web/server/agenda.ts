import "server-only";
import {
  bloqueos,
  citas,
  citasServicios,
  clientes,
  horarios,
  profesionales,
  profesionalesTratamientos,
  registrarActividad,
  series,
  tratamientos,
  type Tx,
} from "@adela/db";
import {
  ANTELACION_MINUTOS_WEB,
  PASO_WEB,
  diaSemana,
  duracionTotal,
  esFecha,
  fechasSerie,
  huecosLibres,
  instanteMadrid,
  partesMadrid,
  puedeCambiarEstado,
  sumarDias,
  type EstadoCita,
  type Intervalo,
  type Tramo,
} from "@adela/dominio";
import { and, asc, eq, gt, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { db } from "./db";

export type Resultado<T = undefined> = { ok: true; valor: T } | { ok: false; error: string };

/** ¿Es el error de PostgreSQL de «dos citas solapadas»? */
export function esSolape(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err.code === "23P01" || err.cause?.code === "23P01";
}

// ── Equipo y horario ─────────────────────────────────────────────────────────

export async function profesionalesActivos() {
  return db().select().from(profesionales).where(eq(profesionales.activo, true)).orderBy(asc(profesionales.orden), asc(profesionales.nombre));
}

export async function profesionalDeUsuario(usuarioId: string) {
  const [p] = await db().select().from(profesionales).where(eq(profesionales.usuarioId, usuarioId));
  return p ?? null;
}

/** Profesionales activas que hacen todos esos tratamientos (sin tratamientos apuntados = los hace todos). */
export async function profesionalesQueHacen(tratamientoIds: string[]) {
  const activas = await profesionalesActivos();
  const asignaciones = await db().select().from(profesionalesTratamientos);
  return activas.filter((p) => {
    const suyos = asignaciones.filter((a) => a.profesionalId === p.id).map((a) => a.tratamientoId);
    return suyos.length === 0 || tratamientoIds.every((t) => suyos.includes(t));
  });
}

export async function horarioDe(profesionalId: string, fecha: string): Promise<Tramo[]> {
  const filas = await db()
    .select()
    .from(horarios)
    .where(and(eq(horarios.profesionalId, profesionalId), eq(horarios.diaSemana, diaSemana(fecha))))
    .orderBy(asc(horarios.inicioMin));
  return filas.map((h) => ({ inicio: h.inicioMin, fin: h.finMin }));
}

/** Intervalos ocupados de una profesional en un rango: citas no canceladas y bloqueos (suyos o de todo el centro). */
export async function ocupados(profesionalId: string, desde: Date, hasta: Date, excluirCita?: string): Promise<(Intervalo & { tipo: "cita" | "bloqueo" })[]> {
  const [c, b] = await Promise.all([
    db()
      .select({ inicio: citas.inicio, fin: citas.fin })
      .from(citas)
      .where(
        and(
          eq(citas.profesionalId, profesionalId),
          ne(citas.estado, "cancelada"),
          lt(citas.inicio, hasta),
          gt(citas.fin, desde),
          excluirCita ? ne(citas.id, excluirCita) : undefined,
        ),
      ),
    bloqueosEntre(desde, hasta, profesionalId),
  ]);
  return [...c.map((x) => ({ ...x, tipo: "cita" as const })), ...b.map((x) => ({ inicio: x.inicio, fin: x.fin, tipo: "bloqueo" as const }))];
}

export async function bloqueosEntre(desde: Date, hasta: Date, profesionalId?: string) {
  return db()
    .select()
    .from(bloqueos)
    .where(
      and(
        isNull(bloqueos.anuladoEn),
        lt(bloqueos.inicio, hasta),
        gt(bloqueos.fin, desde),
        profesionalId ? or(isNull(bloqueos.profesionalId), eq(bloqueos.profesionalId, profesionalId)) : undefined,
      ),
    )
    .orderBy(asc(bloqueos.inicio));
}

const limitesDia = (fecha: string) => ({ desde: instanteMadrid(fecha, 0), hasta: instanteMadrid(sumarDias(fecha, 1), 0) });

/** Horas libres para la web: une los huecos de todas las profesionales que hacen el tratamiento. */
export async function huecosWeb(tratamientoId: string, fecha: string): Promise<{ minutos: number; profesionalId: string }[]> {
  const [t] = await db().select().from(tratamientos).where(and(eq(tratamientos.id, tratamientoId), isNull(tratamientos.anuladoEn)));
  if (!t?.duracionMinutos || !esFecha(fecha)) return [];
  const { desde, hasta } = limitesDia(fecha);
  const minimo = new Date(Date.now() + ANTELACION_MINUTOS_WEB * 60_000);
  const resultado = new Map<number, string>();
  for (const p of await profesionalesQueHacen([tratamientoId])) {
    const libres = huecosLibres({
      fecha,
      horario: await horarioDe(p.id, fecha),
      ocupados: await ocupados(p.id, desde, hasta),
      duracion: t.duracionMinutos,
      paso: PASO_WEB,
      desde: minimo,
    });
    for (const m of libres) if (!resultado.has(m)) resultado.set(m, p.id);
  }
  return [...resultado.entries()].sort((a, b) => a[0] - b[0]).map(([minutos, profesionalId]) => ({ minutos, profesionalId }));
}

// ── Citas ────────────────────────────────────────────────────────────────────

export interface NuevaCita {
  clienteId: string;
  profesionalId: string;
  fecha: string;
  inicioMin: number;
  tratamientoIds: string[];
  nota?: string | null;
  estado: "pendiente" | "confirmada";
  origen: "centro" | "web";
  /** Repetir cada N semanas, M veces en total. */
  repetir?: { cadaSemanas: number; veces: number };
  solicitudId?: string;
}

/** Crea la cita (o la serie entera). Si alguna fecha choca con otra cita o un bloqueo, no se crea ninguna. */
export async function crearCitas(nueva: NuevaCita, usuarioId: string | null, tx?: Tx): Promise<Resultado<string[]>> {
  if (!esFecha(nueva.fecha)) return { ok: false, error: "Elige el día." };
  if (nueva.tratamientoIds.length === 0) return { ok: false, error: "Elige al menos un tratamiento." };
  const lista = await (tx ?? db()).select().from(tratamientos).where(inArray(tratamientos.id, nueva.tratamientoIds));
  const servicios = nueva.tratamientoIds.map((id) => lista.find((t) => t.id === id)).filter((t) => t !== undefined);
  if (servicios.length !== nueva.tratamientoIds.length || servicios.some((s) => s.anuladoEn)) return { ok: false, error: "Algún tratamiento no existe." };
  const duracion = duracionTotal(servicios);
  if (duracion === null) {
    const sin = servicios.filter((s) => s.duracionMinutos === null).map((s) => s.nombre);
    return { ok: false, error: `Falta la duración de: ${sin.join(", ")}. Ponla en Tratamientos.` };
  }
  if (nueva.inicioMin % 5 !== 0) return { ok: false, error: "La hora tiene que ir de 5 en 5 minutos." };
  const repetir = nueva.repetir ?? { cadaSemanas: 1, veces: 1 };
  if (repetir.veces < 1 || repetir.veces > 52 || repetir.cadaSemanas < 1 || repetir.cadaSemanas > 12) {
    return { ok: false, error: "Repetición no válida (hasta 52 veces, cada 1 a 12 semanas)." };
  }
  const fechas = fechasSerie(nueva.fecha, repetir.cadaSemanas, repetir.veces);

  // Bloqueos (vacaciones, descansos): se comprueban aquí; los solapes con citas los rechaza la base de datos.
  for (const f of fechas) {
    const intervalo = { inicio: instanteMadrid(f, nueva.inicioMin), fin: instanteMadrid(f, nueva.inicioMin + duracion) };
    const choque = await bloqueosEntre(intervalo.inicio, intervalo.fin, nueva.profesionalId);
    if (choque.length > 0) return { ok: false, error: `El ${fechaCorta(f)} esa hora está bloqueada (${choque[0]!.motivo ?? choque[0]!.tipo}).` };
  }

  const trabajo = async (t: Tx) => {
    let serieId: string | null = null;
    if (fechas.length > 1) {
      const [s] = await t.insert(series).values({ cadaSemanas: repetir.cadaSemanas, veces: repetir.veces, creadaPor: usuarioId! }).returning();
      serieId = s!.id;
    }
    const ids: string[] = [];
    for (const f of fechas) {
      const inicio = instanteMadrid(f, nueva.inicioMin);
      const fin = instanteMadrid(f, nueva.inicioMin + duracion);
      let creada;
      try {
        // Punto de guardado: si choca, se informa de qué fecha sin perder la explicación.
        [creada] = await t.transaction(async (st) =>
          st
            .insert(citas)
            .values({
              clienteId: nueva.clienteId,
              profesionalId: nueva.profesionalId,
              inicio,
              fin,
              estado: nueva.estado,
              origen: nueva.origen,
              serieId,
              solicitudId: nueva.solicitudId ?? null,
              nota: nueva.nota || null,
              creadaPor: usuarioId,
            })
            .returning(),
        );
      } catch (e) {
        if (esSolape(e)) throw new ErrorSolape(f);
        throw e;
      }
      await t.insert(citasServicios).values(
        servicios.map((s, orden) => ({ citaId: creada!.id, orden, tratamientoId: s.id, duracionMinutos: s.duracionMinutos!, precioCentimos: s.precioCentimos })),
      );
      await registrarActividad(t, { usuarioId, accion: "cita.crear", entidad: "citas", entidadId: creada!.id, despues: creada });
      ids.push(creada!.id);
    }
    return ids;
  };

  try {
    const ids = tx ? await trabajo(tx) : await db().transaction(trabajo);
    return { ok: true, valor: ids };
  } catch (e) {
    if (e instanceof ErrorSolape) {
      return { ok: false, error: fechas.length > 1 ? `El ${fechaCorta(e.fecha)} ya hay otra cita a esa hora. No se ha creado ninguna.` : "Ya hay otra cita a esa hora." };
    }
    throw e;
  }
}

class ErrorSolape extends Error {
  constructor(readonly fecha: string) {
    super("solape");
  }
}

const formatoCorto = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const fechaCorta = (f: string) => formatoCorto.format(new Date(`${f}T12:00:00Z`));

export async function cambiarEstadoCita(citaId: string, estado: EstadoCita, usuarioId: string | null): Promise<Resultado> {
  const [antes] = await db().select().from(citas).where(eq(citas.id, citaId));
  if (!antes) return { ok: false, error: "No existe esa cita." };
  if (!puedeCambiarEstado(antes.estado, estado)) return { ok: false, error: "No se puede cambiar a ese estado." };
  await db().transaction(async (tx) => {
    const [despues] = await tx.update(citas).set({ estado }).where(eq(citas.id, citaId)).returning();
    await registrarActividad(tx, { usuarioId, accion: "cita.estado", entidad: "citas", entidadId: citaId, antes: { estado: antes.estado }, despues: { estado: despues!.estado } });
  });
  return { ok: true, valor: undefined };
}

/** Cambia día, hora o profesional de una cita, manteniendo su duración. */
export async function moverCita(citaId: string, fecha: string, inicioMin: number, profesionalId: string, usuarioId: string): Promise<Resultado> {
  const [antes] = await db().select().from(citas).where(eq(citas.id, citaId));
  if (!antes) return { ok: false, error: "No existe esa cita." };
  if (antes.estado === "cancelada" || antes.estado === "realizada") return { ok: false, error: "Esta cita ya no se puede mover." };
  if (!esFecha(fecha) || inicioMin % 5 !== 0) return { ok: false, error: "Revisa el día y la hora." };
  const duracion = (antes.fin.getTime() - antes.inicio.getTime()) / 60_000;
  const inicio = instanteMadrid(fecha, inicioMin);
  const fin = instanteMadrid(fecha, inicioMin + duracion);
  const choque = await bloqueosEntre(inicio, fin, profesionalId);
  if (choque.length > 0) return { ok: false, error: `Esa hora está bloqueada (${choque[0]!.motivo ?? choque[0]!.tipo}).` };
  try {
    await db().transaction(async (tx) => {
      const [despues] = await tx.update(citas).set({ inicio, fin, profesionalId }).where(eq(citas.id, citaId)).returning();
      await registrarActividad(tx, { usuarioId, accion: "cita.mover", entidad: "citas", entidadId: citaId, antes, despues });
    });
  } catch (e) {
    if (esSolape(e)) return { ok: false, error: "Ya hay otra cita a esa hora." };
    throw e;
  }
  return { ok: true, valor: undefined };
}

export interface CitaVista {
  id: string;
  inicio: Date;
  fin: Date;
  estado: EstadoCita;
  origen: "centro" | "web";
  nota: string | null;
  serieId: string | null;
  profesionalId: string;
  cliente: { id: string; nombre: string; telefono: string | null };
  servicios: string[];
}

/** Citas en un rango (opcionalmente de una profesional), con clienta y servicios. */
export async function citasEntre(
  desde: Date,
  hasta: Date,
  opciones: { profesionalId?: string; incluirCanceladas?: boolean; estado?: EstadoCita } = {},
): Promise<CitaVista[]> {
  const filas = await db()
    .select({ c: citas, cliente: { id: clientes.id, nombre: clientes.nombre, telefono: clientes.telefono } })
    .from(citas)
    .innerJoin(clientes, eq(clientes.id, citas.clienteId))
    .where(
      and(
        lt(citas.inicio, hasta),
        gt(citas.fin, desde),
        opciones.profesionalId ? eq(citas.profesionalId, opciones.profesionalId) : undefined,
        opciones.incluirCanceladas ? undefined : ne(citas.estado, "cancelada"),
        opciones.estado ? eq(citas.estado, opciones.estado) : undefined,
      ),
    )
    .orderBy(asc(citas.inicio));
  if (filas.length === 0) return [];
  const servs = await db()
    .select({ citaId: citasServicios.citaId, nombre: tratamientos.nombre, orden: citasServicios.orden })
    .from(citasServicios)
    .innerJoin(tratamientos, eq(tratamientos.id, citasServicios.tratamientoId))
    .where(inArray(citasServicios.citaId, filas.map((f) => f.c.id)))
    .orderBy(asc(citasServicios.orden));
  return filas.map(({ c, cliente }) => ({
    id: c.id,
    inicio: c.inicio,
    fin: c.fin,
    estado: c.estado,
    origen: c.origen,
    nota: c.nota,
    serieId: c.serieId,
    profesionalId: c.profesionalId,
    cliente,
    servicios: servs.filter((s) => s.citaId === c.id).map((s) => s.nombre),
  }));
}

export function citasDelDia(fecha: string, opciones: { profesionalId?: string; incluirCanceladas?: boolean } = {}) {
  const { desde, hasta } = limitesDia(fecha);
  return citasEntre(desde, hasta, opciones);
}

export { limitesDia, partesMadrid };

/** Horas libres de una profesional un día, para un servicio de `duracion` minutos (pantalla del centro). */
export async function huecosProfesional(profesionalId: string, fecha: string, duracion: number, excluirCita?: string) {
  if (!esFecha(fecha) || duracion <= 0) return { horario: [] as Tramo[], libres: [] as number[] };
  const { desde, hasta } = limitesDia(fecha);
  const horario = await horarioDe(profesionalId, fecha);
  const libres = huecosLibres({ fecha, horario, ocupados: await ocupados(profesionalId, desde, hasta, excluirCita), duracion, paso: 15 });
  return { horario, libres };
}

/** Tratamientos que se pueden poner en una cita (los activos), con su categoría. */
export async function catalogoParaCitas() {
  const { categorias } = await import("@adela/db");
  return db()
    .select({ id: tratamientos.id, nombre: tratamientos.nombre, categoria: categorias.nombre, duracionMinutos: tratamientos.duracionMinutos })
    .from(tratamientos)
    .innerJoin(categorias, eq(categorias.id, tratamientos.categoriaId))
    .where(isNull(tratamientos.anuladoEn))
    .orderBy(asc(categorias.orden), asc(tratamientos.orden));
}

/** Para cada profesional activa, los tratamientos que hace ([] = todos). */
export async function equipoConTratamientos() {
  const [activas, asignaciones] = await Promise.all([profesionalesActivos(), db().select().from(profesionalesTratamientos)]);
  return activas.map((p) => ({ id: p.id, nombre: p.nombre, tratamientoIds: asignaciones.filter((a) => a.profesionalId === p.id).map((a) => a.tratamientoId) }));
}

/** Cancela esta cita y las siguientes de su serie (las que aún no han pasado). */
export async function cancelarSerieDesde(citaId: string, usuarioId: string): Promise<Resultado<number>> {
  const [c] = await db().select().from(citas).where(eq(citas.id, citaId));
  if (!c?.serieId) return { ok: false, error: "Esta cita no se repite." };
  const canceladas = await db().transaction(async (tx) => {
    const filas = await tx
      .update(citas)
      .set({ estado: "cancelada" })
      .where(and(eq(citas.serieId, c.serieId!), inArray(citas.estado, ["pendiente", "confirmada"]), gt(citas.inicio, new Date(c.inicio.getTime() - 1))))
      .returning({ id: citas.id });
    for (const f of filas) await registrarActividad(tx, { usuarioId, accion: "cita.estado", entidad: "citas", entidadId: f.id, despues: { estado: "cancelada", motivo: "serie" } });
    return filas.length;
  });
  return { ok: true, valor: canceladas };
}

export async function detalleCita(citaId: string) {
  const [fila] = await db()
    .select({ c: citas, cliente: clientes, profesional: profesionales })
    .from(citas)
    .innerJoin(clientes, eq(clientes.id, citas.clienteId))
    .innerJoin(profesionales, eq(profesionales.id, citas.profesionalId))
    .where(eq(citas.id, citaId));
  if (!fila) return null;
  const servicios = await db()
    .select({ nombre: tratamientos.nombre, duracion: citasServicios.duracionMinutos, precio: citasServicios.precioCentimos })
    .from(citasServicios)
    .innerJoin(tratamientos, eq(tratamientos.id, citasServicios.tratamientoId))
    .where(eq(citasServicios.citaId, citaId))
    .orderBy(asc(citasServicios.orden));
  return { ...fila, servicios };
}
