import "server-only";
import {
  centro,
  citasServicios,
  clientes,
  consentimientosFirmados,
  fotosClientes,
  modelosConsentimiento,
  modelosConsentimientoTratamientos,
  registrarActividad,
  tratamientos,
  usuarios,
} from "@adela/db";
import { MAX_FOTO_BYTES, TIPOS_FOTO, hoyEnMadrid, rellenarConsentimiento, validarFirma, validarModeloConsentimiento } from "@adela/dominio";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { diaLargo } from "@/lib/fechas";
import { requerirSesion } from "./auth";
import { db } from "./db";

export type Resultado<T = undefined> = { ok: true; valor: T } | { ok: false; error: string };

// ── Fotos ────────────────────────────────────────────────────────────────────

export async function fotosDeClienta(clienteId: string) {
  return db()
    .select({ id: fotosClientes.id, tipo: fotosClientes.tipo, nota: fotosClientes.nota, subidaEn: fotosClientes.subidaEn, quien: usuarios.nombre })
    .from(fotosClientes)
    .innerJoin(usuarios, eq(usuarios.id, fotosClientes.subidaPor))
    .where(eq(fotosClientes.clienteId, clienteId))
    .orderBy(desc(fotosClientes.subidaEn));
}

export async function subirFoto(d: { clienteId: string; tipo: string; nota: string; archivo: File | null }): Promise<Resultado> {
  const { usuario } = await requerirSesion("clientas.gestionar");
  const a = d.archivo;
  if (!a || a.size === 0) return { ok: false, error: "Elige una foto." };
  if (!(TIPOS_FOTO as readonly string[]).includes(a.type)) return { ok: false, error: "La foto tiene que ser JPG, PNG o WEBP." };
  if (a.size > MAX_FOTO_BYTES) return { ok: false, error: "La foto es demasiado grande." };
  const tipo = (["antes", "despues", "otra"] as const).find((t) => t === d.tipo) ?? "otra";
  const [c] = await db().select().from(clientes).where(and(eq(clientes.id, d.clienteId), isNull(clientes.anonimizadaEn)));
  if (!c) return { ok: false, error: "No existe esa ficha." };
  await db().transaction(async (tx) => {
    const [f] = await tx
      .insert(fotosClientes)
      .values({ clienteId: c.id, tipo, nota: d.nota.trim().slice(0, 200) || null, mime: a.type as (typeof TIPOS_FOTO)[number], datos: Buffer.from(await a.arrayBuffer()), subidaPor: usuario.id })
      .returning({ id: fotosClientes.id });
    await registrarActividad(tx, { usuarioId: usuario.id, accion: "foto.subir", entidad: "clientes", entidadId: c.id, despues: { foto: f!.id, tipo } });
  });
  return { ok: true, valor: undefined };
}

export async function datosFoto(clienteId: string, id: string) {
  const [f] = await db()
    .select({ mime: fotosClientes.mime, datos: fotosClientes.datos })
    .from(fotosClientes)
    .where(and(eq(fotosClientes.id, id), eq(fotosClientes.clienteId, clienteId)));
  return f ?? null;
}

export async function borrarFoto(clienteId: string, id: string): Promise<Resultado> {
  const { usuario } = await requerirSesion("clientas.gestionar");
  await db().transaction(async (tx) => {
    const borradas = await tx.delete(fotosClientes).where(and(eq(fotosClientes.id, id), eq(fotosClientes.clienteId, clienteId))).returning({ id: fotosClientes.id });
    if (borradas.length) await registrarActividad(tx, { usuarioId: usuario.id, accion: "foto.borrar", entidad: "clientes", entidadId: clienteId, antes: { foto: id } });
  });
  return { ok: true, valor: undefined };
}

// ── Modelos de consentimiento ────────────────────────────────────────────────

export async function modelos(soloActivos = false) {
  const [lista, enlaces] = await Promise.all([
    db()
      .select()
      .from(modelosConsentimiento)
      .where(soloActivos ? eq(modelosConsentimiento.activo, true) : undefined)
      .orderBy(asc(modelosConsentimiento.nombre)),
    db()
      .select({ modeloId: modelosConsentimientoTratamientos.modeloId, tratamientoId: tratamientos.id, nombre: tratamientos.nombre })
      .from(modelosConsentimientoTratamientos)
      .innerJoin(tratamientos, eq(tratamientos.id, modelosConsentimientoTratamientos.tratamientoId)),
  ]);
  return lista.map((m) => ({ ...m, tratamientos: enlaces.filter((e) => e.modeloId === m.id).map((e) => ({ id: e.tratamientoId, nombre: e.nombre })) }));
}

export async function guardarModelo(d: { id?: string; nombre: string; texto: string; activo: boolean; tratamientoIds: string[] }): Promise<Resultado> {
  const { usuario } = await requerirSesion("configuracion.gestionar");
  const e = validarModeloConsentimiento(d.nombre, d.texto);
  if (e) return { ok: false, error: e };
  const nombre = d.nombre.trim();
  const [repetido] = await db()
    .select({ id: modelosConsentimiento.id })
    .from(modelosConsentimiento)
    .where(and(eq(modelosConsentimiento.nombre, nombre), d.id ? ne(modelosConsentimiento.id, d.id) : undefined));
  if (repetido) return { ok: false, error: "Ya hay un consentimiento con ese nombre." };
  await db().transaction(async (tx) => {
    let id = d.id;
    const valores = { nombre, texto: d.texto.trim(), activo: d.activo, actualizadoEn: new Date() };
    if (id) await tx.update(modelosConsentimiento).set(valores).where(eq(modelosConsentimiento.id, id));
    else id = (await tx.insert(modelosConsentimiento).values(valores).returning())[0]!.id;
    await tx.delete(modelosConsentimientoTratamientos).where(eq(modelosConsentimientoTratamientos.modeloId, id));
    if (d.tratamientoIds.length) await tx.insert(modelosConsentimientoTratamientos).values(d.tratamientoIds.map((t) => ({ modeloId: id!, tratamientoId: t })));
    await registrarActividad(tx, { usuarioId: usuario.id, accion: "consentimiento.modelo", entidad: "modelos_consentimiento", entidadId: id, despues: { nombre, tratamientos: d.tratamientoIds.length } });
  });
  return { ok: true, valor: undefined };
}

// ── Consentimientos firmados ─────────────────────────────────────────────────

export async function consentimientosDeClienta(clienteId: string) {
  return db()
    .select({
      id: consentimientosFirmados.id,
      modeloId: consentimientosFirmados.modeloId,
      nombre: consentimientosFirmados.nombreModelo,
      firmadoEn: consentimientosFirmados.firmadoEn,
      revocadoEn: consentimientosFirmados.revocadoEn,
    })
    .from(consentimientosFirmados)
    .where(eq(consentimientosFirmados.clienteId, clienteId))
    .orderBy(desc(consentimientosFirmados.firmadoEn));
}

export async function consentimientoFirmado(id: string) {
  const [c] = await db()
    .select({ c: consentimientosFirmados, quien: usuarios.nombre })
    .from(consentimientosFirmados)
    .innerJoin(usuarios, eq(usuarios.id, consentimientosFirmados.registradoPor))
    .where(eq(consentimientosFirmados.id, id));
  return c ?? null;
}

/** Texto del modelo con los datos de la clienta y la fecha de hoy, tal como lo va a firmar. */
export async function textoParaFirmar(modeloId: string, clienteId: string) {
  const [[m], [c], [ce]] = await Promise.all([
    db().select().from(modelosConsentimiento).where(eq(modelosConsentimiento.id, modeloId)),
    db().select().from(clientes).where(and(eq(clientes.id, clienteId), isNull(clientes.anonimizadaEn))),
    db().select({ nombre: centro.nombre }).from(centro).limit(1),
  ]);
  if (!m || !c) return null;
  return { modelo: m, clienta: c, texto: rellenarConsentimiento(m.texto, { nombre: c.nombre, fecha: diaLargo(hoyEnMadrid(new Date())), centro: ce?.nombre ?? "el centro" }) };
}

export async function firmarConsentimiento(d: { clienteId: string; modeloId: string; firma: string; firmante: string; citaId?: string }): Promise<Resultado<string>> {
  const { usuario } = await requerirSesion("clientas.gestionar");
  const e = validarFirma(d.firma);
  if (e) return { ok: false, error: e };
  const firmante = d.firmante.trim();
  if (firmante.length < 2 || firmante.length > 80) return { ok: false, error: "Escribe el nombre de quien firma." };
  const t = await textoParaFirmar(d.modeloId, d.clienteId);
  if (!t || !t.modelo.activo) return { ok: false, error: "No existe ese consentimiento." };
  const id = await db().transaction(async (tx) => {
    const [f] = await tx
      .insert(consentimientosFirmados)
      .values({ clienteId: t.clienta.id, modeloId: t.modelo.id, nombreModelo: t.modelo.nombre, texto: t.texto, firma: d.firma, firmante, citaId: d.citaId || null, registradoPor: usuario.id })
      .returning({ id: consentimientosFirmados.id });
    await registrarActividad(tx, { usuarioId: usuario.id, accion: "consentimiento.firmar", entidad: "clientes", entidadId: t.clienta.id, despues: { consentimiento: t.modelo.nombre } });
    return f!.id;
  });
  return { ok: true, valor: id };
}

export async function revocarConsentimiento(id: string): Promise<Resultado> {
  const { usuario } = await requerirSesion("clientas.gestionar");
  const [c] = await db()
    .update(consentimientosFirmados)
    .set({ revocadoEn: new Date(), revocadoPor: usuario.id })
    .where(and(eq(consentimientosFirmados.id, id), isNull(consentimientosFirmados.revocadoEn)))
    .returning();
  if (!c) return { ok: false, error: "Ya estaba retirado." };
  await registrarActividad(db(), { usuarioId: usuario.id, accion: "consentimiento.revocar", entidad: "clientes", entidadId: c.clienteId, despues: { consentimiento: c.nombreModelo } });
  return { ok: true, valor: undefined };
}

/**
 * Consentimientos que faltan por firmar para unas citas: los que piden sus tratamientos y la clienta no tiene firmados
 * (o los retiró). Devuelve, por cita, los modelos que faltan.
 */
export async function consentimientosQueFaltan(citas: { id: string; clienteId: string }[]): Promise<Map<string, { id: string; nombre: string }[]>> {
  const r = new Map<string, { id: string; nombre: string }[]>();
  if (!citas.length) return r;
  const piden = await db()
    .selectDistinct({ citaId: citasServicios.citaId, modeloId: modelosConsentimiento.id, nombre: modelosConsentimiento.nombre })
    .from(citasServicios)
    .innerJoin(modelosConsentimientoTratamientos, eq(modelosConsentimientoTratamientos.tratamientoId, citasServicios.tratamientoId))
    .innerJoin(modelosConsentimiento, and(eq(modelosConsentimiento.id, modelosConsentimientoTratamientos.modeloId), eq(modelosConsentimiento.activo, true)))
    .where(inArray(citasServicios.citaId, citas.map((c) => c.id)));
  if (!piden.length) return r;
  const firmados = await db()
    .select({ clienteId: consentimientosFirmados.clienteId, modeloId: consentimientosFirmados.modeloId })
    .from(consentimientosFirmados)
    .where(and(inArray(consentimientosFirmados.clienteId, [...new Set(citas.map((c) => c.clienteId))]), isNull(consentimientosFirmados.revocadoEn)));
  for (const p of piden) {
    const cita = citas.find((c) => c.id === p.citaId)!;
    if (firmados.some((f) => f.clienteId === cita.clienteId && f.modeloId === p.modeloId)) continue;
    r.set(p.citaId, [...(r.get(p.citaId) ?? []), { id: p.modeloId, nombre: p.nombre }]);
  }
  return r;
}
