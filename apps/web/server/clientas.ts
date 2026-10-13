import "server-only";
import {
  centro,
  citas,
  citasServicios,
  clientes,
  consentimientos,
  mensajes,
  notasClientes,
  tareas,
  registrarActividad,
  solicitudesReserva,
  tratamientos,
  usuarios,
} from "@adela/db";
import {
  estaInactiva,
  horaATexto,
  hoyEnMadrid,
  leerAjustesAvisos,
  partesMadrid,
  telefonoDeBusqueda,
  validarClienta,
  type DatosClienta,
  type Segmento,
} from "@adela/dominio";
import { and, asc, desc, eq, ilike, inArray, isNull, like, or, sql } from "drizzle-orm";
import { requerirSesion } from "./auth";
import { db } from "./db";

export type Resultado<T = undefined> = { ok: true; valor: T } | { ok: false; error: string };

/** Busca por nombre o teléfono entre las fichas activas. */
export async function buscarClientas(texto: string, limite = 30) {
  await requerirSesion("clientas.gestionar");
  const q = texto.trim();
  const tel = telefonoDeBusqueda(q);
  return db()
    .select()
    .from(clientes)
    .where(
      and(
        isNull(clientes.anonimizadaEn),
        q
          ? or(ilike(clientes.nombre, `%${q.replace(/[%_\\]/g, "")}%`), tel ? like(clientes.telefono, `%${tel.replace(/^\+34/, "")}%`) : undefined)
          : undefined,
      ),
    )
    .orderBy(asc(clientes.nombre))
    .limit(limite);
}

export async function crearClienta(d: DatosClienta & { aceptaAvisosCitas: boolean; aceptaPromociones: boolean }): Promise<Resultado<string>> {
  const { usuario } = await requerirSesion("clientas.gestionar");
  const v = validarClienta(d, hoyEnMadrid(new Date()));
  if (!v.ok) return v;
  if (v.datos.telefono) {
    const [existe] = await db()
      .select({ id: clientes.id, nombre: clientes.nombre })
      .from(clientes)
      .where(and(eq(clientes.telefono, v.datos.telefono), isNull(clientes.anonimizadaEn)));
    if (existe) return { ok: false, error: `Ese teléfono ya es de ${existe.nombre}.` };
  }
  const id = await db().transaction(async (tx) => {
    const [c] = await tx.insert(clientes).values({ ...v.datos, aceptaAvisosCitas: d.aceptaAvisosCitas, aceptaPromociones: d.aceptaPromociones }).returning();
    for (const [tipo, aceptado] of [["avisos_citas", d.aceptaAvisosCitas], ["promociones", d.aceptaPromociones]] as const) {
      if (aceptado) await tx.insert(consentimientos).values({ clienteId: c!.id, tipo, aceptado, canal: "centro", registradoPor: usuario.id });
    }
    await registrarActividad(tx, { usuarioId: usuario.id, accion: "clienta.crear", entidad: "clientes", entidadId: c!.id, despues: c });
    return c!.id;
  });
  return { ok: true, valor: id };
}

export async function editarClienta(id: string, d: DatosClienta & { aceptaAvisosCitas: boolean; aceptaPromociones: boolean }): Promise<Resultado> {
  const { usuario } = await requerirSesion("clientas.gestionar");
  const v = validarClienta(d, hoyEnMadrid(new Date()));
  if (!v.ok) return v;
  const [antes] = await db().select().from(clientes).where(and(eq(clientes.id, id), isNull(clientes.anonimizadaEn)));
  if (!antes) return { ok: false, error: "No existe esa ficha." };
  if (v.datos.telefono && v.datos.telefono !== antes.telefono) {
    const [existe] = await db()
      .select({ nombre: clientes.nombre })
      .from(clientes)
      .where(and(eq(clientes.telefono, v.datos.telefono), isNull(clientes.anonimizadaEn)));
    if (existe) return { ok: false, error: `Ese teléfono ya es de ${existe.nombre}.` };
  }
  await db().transaction(async (tx) => {
    const [despues] = await tx
      .update(clientes)
      .set({ ...v.datos, aceptaAvisosCitas: d.aceptaAvisosCitas, aceptaPromociones: d.aceptaPromociones })
      .where(eq(clientes.id, id))
      .returning();
    for (const [tipo, antesVal, ahora] of [
      ["avisos_citas", antes.aceptaAvisosCitas, d.aceptaAvisosCitas],
      ["promociones", antes.aceptaPromociones, d.aceptaPromociones],
    ] as const) {
      if (antesVal !== ahora) await tx.insert(consentimientos).values({ clienteId: id, tipo, aceptado: ahora, canal: "centro", registradoPor: usuario.id });
    }
    await registrarActividad(tx, { usuarioId: usuario.id, accion: "clienta.editar", entidad: "clientes", entidadId: id, antes, despues });
  });
  return { ok: true, valor: undefined };
}

export async function anadirNota(clienteId: string, texto: string): Promise<Resultado> {
  const { usuario } = await requerirSesion("clientas.gestionar");
  const t = texto.trim();
  if (!t) return { ok: false, error: "Escribe la nota." };
  if (t.length > 2000) return { ok: false, error: "La nota es demasiado larga." };
  await db().insert(notasClientes).values({ clienteId, texto: t, autorId: usuario.id });
  return { ok: true, valor: undefined };
}

export type EventoFicha =
  | { tipo: "cita"; cuando: Date; id: string; estado: string; servicios: string[]; origen: string }
  | { tipo: "nota"; cuando: Date; texto: string; autor: string }
  | { tipo: "consentimiento"; cuando: Date; permiso: string; aceptado: boolean; canal: string }
  | { tipo: "alta"; cuando: Date };

/** Ficha con su línea temporal (más reciente primero). */
export async function fichaClienta(id: string) {
  await requerirSesion("clientas.gestionar");
  const [c] = await db().select().from(clientes).where(eq(clientes.id, id));
  if (!c) return null;
  const [lasCitas, notas, permisos] = await Promise.all([
    db().select().from(citas).where(eq(citas.clienteId, id)).orderBy(desc(citas.inicio)),
    db()
      .select({ n: notasClientes, autor: usuarios.nombre })
      .from(notasClientes)
      .innerJoin(usuarios, eq(usuarios.id, notasClientes.autorId))
      .where(eq(notasClientes.clienteId, id)),
    db().select().from(consentimientos).where(eq(consentimientos.clienteId, id)),
  ]);
  const servs = lasCitas.length
    ? await db()
        .select({ citaId: citasServicios.citaId, nombre: tratamientos.nombre })
        .from(citasServicios)
        .innerJoin(tratamientos, eq(tratamientos.id, citasServicios.tratamientoId))
        .where(inArray(citasServicios.citaId, lasCitas.map((x) => x.id)))
        .orderBy(asc(citasServicios.orden))
    : [];
  const eventos: EventoFicha[] = [
    ...lasCitas.map((x) => ({
      tipo: "cita" as const,
      cuando: x.inicio,
      id: x.id,
      estado: x.estado,
      origen: x.origen,
      servicios: servs.filter((s) => s.citaId === x.id).map((s) => s.nombre),
    })),
    ...notas.map(({ n, autor }) => ({ tipo: "nota" as const, cuando: n.creadaEn, texto: n.texto, autor })),
    ...permisos.map((p) => ({ tipo: "consentimiento" as const, cuando: p.cuando, permiso: p.tipo, aceptado: p.aceptado, canal: p.canal })),
    { tipo: "alta" as const, cuando: c.creadaEn },
  ].sort((a, b) => b.cuando.getTime() - a.cuando.getTime());
  const ahora = Date.now();
  return {
    clienta: c,
    eventos,
    proximas: lasCitas.filter((x) => x.inicio.getTime() > ahora && (x.estado === "confirmada" || x.estado === "pendiente")).length,
    realizadas: lasCitas.filter((x) => x.estado === "realizada").length,
    noVino: lasCitas.filter((x) => x.estado === "no_presentada").length,
  };
}

/** Todos los datos de la clienta, para entregárselos si los pide (RGPD). */
export async function exportarClienta(id: string) {
  const { usuario } = await requerirSesion("configuracion.gestionar");
  const ficha = await fichaClienta(id);
  if (!ficha) return null;
  const solicitudes = ficha.clienta.telefono
    ? await db().select().from(solicitudesReserva).where(eq(solicitudesReserva.telefono, ficha.clienta.telefono))
    : [];
  await registrarActividad(db(), { usuarioId: usuario.id, accion: "clienta.exportar", entidad: "clientes", entidadId: id });
  return { generado: new Date().toISOString(), ...ficha, solicitudes };
}

/**
 * Supresión a petición de la clienta (RGPD): se borran sus datos personales y notas; las citas quedan sin nombre
 * para que la agenda y, más adelante, la facturación sigan cuadrando.
 */
export async function anonimizarClienta(id: string): Promise<Resultado> {
  const { usuario } = await requerirSesion("configuracion.gestionar");
  const [c] = await db().select().from(clientes).where(and(eq(clientes.id, id), isNull(clientes.anonimizadaEn)));
  if (!c) return { ok: false, error: "No existe esa ficha." };
  await db().transaction(async (tx) => {
    await tx
      .update(clientes)
      .set({ nombre: "Clienta eliminada", telefono: null, email: null, fechaNacimiento: null, notas: null, aceptaAvisosCitas: false, aceptaPromociones: false, anonimizadaEn: new Date() })
      .where(eq(clientes.id, id));
    await tx.update(notasClientes).set({ texto: "[nota eliminada]" }).where(eq(notasClientes.clienteId, id));
    await tx.update(citas).set({ nota: null }).where(eq(citas.clienteId, id));
    // Los mensajes que se le prepararon llevan su nombre: se borran. Las tareas sobre ella se quedan sin texto.
    await tx.delete(mensajes).where(eq(mensajes.clienteId, id));
    await tx.update(tareas).set({ texto: "[tarea de una clienta eliminada]" }).where(eq(tareas.clienteId, id));
    if (c.telefono) {
      await tx.update(solicitudesReserva).set({ nombre: "Clienta eliminada", telefono: "+34000000000", nota: null }).where(eq(solicitudesReserva.telefono, c.telefono));
    }
    await registrarActividad(tx, { usuarioId: usuario.id, accion: "clienta.suprimir", entidad: "clientes", entidadId: id });
  });
  return { ok: true, valor: undefined };
}

/** Clientas de un segmento, con un dato que explica por qué están (última visita, cumpleaños…). */
export async function clientasDeSegmento(segmento: Segmento): Promise<{ id: string; nombre: string; telefono: string | null; promociones: boolean; dato: string }[]> {
  await requerirSesion("clientas.gestionar");
  const hoy = hoyEnMadrid(new Date());
  const ultima = sql<string | null>`(select to_char(max(ci.inicio at time zone 'Europe/Madrid'), 'YYYY-MM-DD') from citas ci where ci.cliente_id = "clientes"."id" and ci.estado = 'realizada')`;
  const proxima = sql<Date | null>`(select min(ci.inicio) from citas ci where ci.cliente_id = "clientes"."id" and ci.inicio > now() and ci.estado in ('pendiente', 'confirmada'))`;
  const filas = await db().select({ c: clientes, ultima, proxima }).from(clientes).where(isNull(clientes.anonimizadaEn)).orderBy(asc(clientes.nombre));
  const fecha = (f: string) => f.split("-").reverse().join("/");
  const conBono =
    segmento === "con_bono"
      ? new Set(
          (
            await db().execute<{ cliente_id: string }>(
              sql`select b.cliente_id from bonos b where b.anulado_en is null and (b.caduca_en is null or b.caduca_en >= ${hoy}) and b.sesiones > coalesce((select sum(u.cantidad) from usos_bono u where u.bono_id = b.id), 0)`,
            )
          ).map((r) => r.cliente_id),
        )
      : null;
  const dias = (await ajustesAvisosInactividad()) || 90;
  const lista = filas.flatMap(({ c, ultima: u, proxima: p }) => {
    const proximaFecha = p ? new Date(p) : null;
    switch (segmento) {
      case "proxima_cita":
        return proximaFecha ? [{ c, dato: `Próxima cita: ${fechaHoraCorta(proximaFecha)}` }] : [];
      case "inactivas":
        return estaInactiva(u, proximaFecha !== null, hoy, dias) ? [{ c, dato: `Última visita: ${fecha(u!)}` }] : [];
      case "cumpleanos_mes":
        return c.fechaNacimiento && c.fechaNacimiento.slice(5, 7) === hoy.slice(5, 7) ? [{ c, dato: `Cumple el ${Number(c.fechaNacimiento.slice(8))}` }] : [];
      case "con_bono":
        return conBono!.has(c.id) ? [{ c, dato: "Tiene bono activo" }] : [];
      case "nuevas":
        return partesMadrid(c.creadaEn).fecha.slice(0, 7) === hoy.slice(0, 7) ? [{ c, dato: `Alta: ${fecha(partesMadrid(c.creadaEn).fecha)}` }] : [];
      case "promociones":
        return c.aceptaPromociones ? [{ c, dato: u ? `Última visita: ${fecha(u)}` : "Aún no ha venido" }] : [];
    }
  });
  return lista.map(({ c, dato }) => ({ id: c.id, nombre: c.nombre, telefono: c.telefono, promociones: c.aceptaPromociones, dato }));
}

async function ajustesAvisosInactividad(): Promise<number> {
  const [c] = await db().select({ avisos: centro.avisos }).from(centro).limit(1);
  return leerAjustesAvisos(c?.avisos).diasInactiva;
}

const fechaHoraCorta = (d: Date) => {
  const p = partesMadrid(d);
  return `${p.fecha.split("-").reverse().join("/")} ${horaATexto(p.minutos)}`;
};

/** Mensajes preparados para una clienta (más recientes primero). */
export async function mensajesDeClienta(id: string) {
  return db()
    .select({ m: mensajes, quien: usuarios.nombre })
    .from(mensajes)
    .innerJoin(usuarios, eq(usuarios.id, mensajes.usuarioId))
    .where(eq(mensajes.clienteId, id))
    .orderBy(desc(mensajes.cuando));
}
