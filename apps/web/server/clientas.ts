import "server-only";
import {
  citas,
  citasServicios,
  clientes,
  consentimientos,
  notasClientes,
  registrarActividad,
  solicitudesReserva,
  tratamientos,
  usuarios,
} from "@adela/db";
import { hoyEnMadrid, telefonoDeBusqueda, validarClienta, type DatosClienta } from "@adela/dominio";
import { and, asc, desc, eq, ilike, inArray, isNull, like, or } from "drizzle-orm";
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
    if (c.telefono) {
      await tx.update(solicitudesReserva).set({ nombre: "Clienta eliminada", telefono: "+34000000000", nota: null }).where(eq(solicitudesReserva.telefono, c.telefono));
    }
    await registrarActividad(tx, { usuarioId: usuario.id, accion: "clienta.suprimir", entidad: "clientes", entidadId: id });
  });
  return { ok: true, valor: undefined };
}
