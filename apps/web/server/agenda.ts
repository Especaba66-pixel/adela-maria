import "server-only";
import {
  bloqueos,
  centro,
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
  cabeCita,
  diaSemana,
  duracionTotal,
  esFecha,
  fechasSerie,
  huecosLibres,
  instanteMadrid,
  partesMadrid,
  puedeCambiarEstado,
  sumarDias,
  type CitaOcupa,
  type EstadoCita,
  type Tramo,
} from "@adela/dominio";
import { and, asc, eq, gt, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { db } from "./db";

export type Resultado<T = undefined> = { ok: true; valor: T } | { ok: false; error: string };

/** Si el error es de la regla de cabinas o exclusivos de la base de datos, el mensaje para la pantalla. */
export function mensajeSinHueco(e: unknown): string | null {
  const err = e as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const codigo = err.cause?.code ?? err.code;
  if (codigo !== "23P01") return null;
  const texto = err.cause?.message ?? err.message ?? "";
  return texto.includes("cita_exclusiva")
    ? "A esa hora coincide con un tratamiento que necesita a la profesional en exclusiva (como el microblading)."
    : "No queda cabina libre a esa hora.";
}

/** Cuántas citas puede haber a la vez (cabinas). Sin indicar, 1. */
export async function cabinas(): Promise<number> {
  const [c] = await db().select({ cabinas: centro.cabinas }).from(centro).limit(1);
  return c?.cabinas ?? 1;
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

/** Citas no canceladas de todo el centro en un rango (cuentan para las cabinas). */
export async function citasQueOcupan(desde: Date, hasta: Date, excluirCita?: string): Promise<CitaOcupa[]> {
  return db()
    .select({ inicio: citas.inicio, fin: citas.fin, exclusiva: citas.exclusiva, profesionalId: citas.profesionalId })
    .from(citas)
    .where(and(ne(citas.estado, "cancelada"), lt(citas.inicio, hasta), gt(citas.fin, desde), excluirCita ? ne(citas.id, excluirCita) : undefined));
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

/** Horas de comienzo libres para una profesional: horario, bloqueos, cabinas y exclusivos. */
async function libresDe(profesionalId: string, fecha: string, duracion: number, exclusiva: boolean, paso: number, desdeMinimo?: Date, excluirCita?: string) {
  const { desde, hasta } = limitesDia(fecha);
  const [horario, bloq, ocupan, capacidad] = await Promise.all([
    horarioDe(profesionalId, fecha),
    bloqueosEntre(desde, hasta, profesionalId),
    citasQueOcupan(desde, hasta, excluirCita),
    cabinas(),
  ]);
  const libres = huecosLibres({
    fecha,
    horario,
    ocupados: bloq,
    duracion,
    paso,
    desde: desdeMinimo,
    admite: (i) => cabeCita({ ...i, exclusiva, profesionalId }, ocupan, capacidad),
  });
  return { horario, libres };
}

/** Horas libres para la web: une los huecos de todas las profesionales que hacen el tratamiento. */
export async function huecosWeb(tratamientoId: string, fecha: string): Promise<{ minutos: number; profesionalId: string }[]> {
  const [t] = await db().select().from(tratamientos).where(and(eq(tratamientos.id, tratamientoId), isNull(tratamientos.anuladoEn)));
  if (!t?.duracionMinutos || !esFecha(fecha)) return [];
  const minimo = new Date(Date.now() + ANTELACION_MINUTOS_WEB * 60_000);
  const resultado = new Map<number, string>();
  for (const p of await profesionalesQueHacen([tratamientoId])) {
    const { libres } = await libresDe(p.id, fecha, t.duracionMinutos, t.exclusivo, PASO_WEB, minimo);
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
              exclusiva: servicios.some((s) => s.exclusivo),
              origen: nueva.origen,
              serieId,
              solicitudId: nueva.solicitudId ?? null,
              nota: nueva.nota || null,
              creadaPor: usuarioId,
            })
            .returning(),
        );
      } catch (e) {
        const mensaje = mensajeSinHueco(e);
        if (mensaje) throw new ErrorSolape(f, mensaje);
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
      return { ok: false, error: fechas.length > 1 ? `El ${fechaCorta(e.fecha)}: ${e.mensaje.charAt(0).toLowerCase()}${e.mensaje.slice(1)} No se ha creado ninguna.` : e.mensaje };
    }
    throw e;
  }
}

class ErrorSolape extends Error {
  constructor(
    readonly fecha: string,
    readonly mensaje: string,
  ) {
    super("sin hueco");
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
    const mensaje = mensajeSinHueco(e);
    if (mensaje) return { ok: false, error: mensaje };
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

/** Horas libres de una profesional un día para esos tratamientos (pantalla del centro). */
export async function huecosProfesional(profesionalId: string, fecha: string, tratamientoIds: string[]) {
  const lista = tratamientoIds.length ? await db().select().from(tratamientos).where(inArray(tratamientos.id, tratamientoIds)) : [];
  const duracion = duracionTotal(lista);
  if (!esFecha(fecha) || !duracion) return { horario: [] as Tramo[], libres: [] as number[] };
  return libresDe(profesionalId, fecha, duracion, lista.some((t) => t.exclusivo), 15);
}

/** Tratamientos que se pueden poner en una cita (los activos), con su categoría. */
export async function catalogoParaCitas() {
  const { categorias } = await import("@adela/db");
  return db()
    .select({
      id: tratamientos.id,
      nombre: tratamientos.nombre,
      categoria: categorias.nombre,
      duracionMinutos: tratamientos.duracionMinutos,
      exclusivo: tratamientos.exclusivo,
    })
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
