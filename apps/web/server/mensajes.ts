import "server-only";
import { bonos, centro, clientes, mensajes, plantillas, registrarActividad } from "@adela/db";
import { cuerpoPlantilla, enlaceWhatsapp, horaATexto, partesMadrid, rellenarPlantilla, textoQuedan, type PlantillaMeta } from "@adela/dominio";
import { eq, sql } from "drizzle-orm";
import { diaLargo } from "@/lib/fechas";
import { detalleCita } from "./agenda";
import { atenderAviso } from "./avisos";
import { db } from "./db";
import { apiWhatsapp, llamarMeta } from "./whatsapp";

export type Preparado = { ok: true; enlace: string; texto: string } | { ok: false; error: string };

export interface PeticionMensaje {
  clienteId: string;
  plantilla: string;
  citaId?: string;
  bonoId?: string;
  /** Aviso que queda atendido al escribirle. */
  clave?: string;
}

type Plantilla = typeof plantillas.$inferSelect;

/** Datos de Meta de una plantilla, si ya está aprobada y dada de alta en la app. */
export function plantillaMeta(p: Plantilla): PlantillaMeta | null {
  if (!p.metaNombre || !p.metaCategoria) return null;
  return { nombre: p.metaNombre, idioma: p.metaIdioma, categoria: p.metaCategoria, variables: p.metaVariables, botones: p.metaBotones };
}

/** ¿Se puede enviar sola esta plantilla (API configurada y plantilla aprobada en Meta)? */
export const enviable = (p: Plantilla) => apiWhatsapp() && plantillaMeta(p) !== null;

/**
 * Compone el mensaje de una plantilla para una clienta: comprueba su teléfono y su permiso y rellena las variables.
 * Confirmar lo que ella misma pidió no necesita permiso; lo demás, el que corresponda.
 */
async function componer(d: PeticionMensaje) {
  const [[c], [p], [centroDatos]] = await Promise.all([
    db().select().from(clientes).where(eq(clientes.id, d.clienteId)),
    db().select().from(plantillas).where(eq(plantillas.clave, d.plantilla)),
    db().select({ nombre: centro.nombre }).from(centro).limit(1),
  ]);
  if (!c || c.anonimizadaEn || !p) return { ok: false as const, error: "No se encuentra la clienta o el mensaje." };
  if (!c.telefono) return { ok: false as const, error: `${c.nombre} no tiene teléfono.` };
  if (d.plantilla !== "confirmar_cita") {
    if (p.permiso === "cita" && !c.aceptaAvisosCitas) return { ok: false as const, error: `${c.nombre} no ha dado permiso para avisos de citas.` };
    if (p.permiso === "promocion" && !c.aceptaPromociones) return { ok: false as const, error: `${c.nombre} no ha dado permiso para promociones.` };
  }

  const valores: Record<string, string> = { nombre: c.nombre.trim().split(/\s+/)[0] ?? c.nombre, centro: centroDatos?.nombre ?? "" };
  if (d.citaId) {
    const cita = await detalleCita(d.citaId);
    if (cita && cita.c.clienteId === c.id) {
      const ini = partesMadrid(cita.c.inicio);
      Object.assign(valores, { fecha: diaLargo(ini.fecha), hora: horaATexto(ini.minutos), servicios: cita.servicios.map((s) => s.nombre).join(" y ") });
    }
  }
  if (d.bonoId) {
    const [b] = await db()
      .select({ nombre: bonos.nombre, sesiones: bonos.sesiones, clienteId: bonos.clienteId, usadas: sql<number>`coalesce((select sum(u.cantidad) from usos_bono u where u.bono_id = "bonos"."id"), 0)::int` })
      .from(bonos)
      .where(eq(bonos.id, d.bonoId));
    if (b && b.clienteId === c.id) Object.assign(valores, { bono: b.nombre, quedan: textoQuedan(b.sesiones - b.usadas).replace(/^quedan? /, "") });
  }
  return { ok: true as const, clienta: c, telefono: c.telefono, plantilla: p, valores, texto: rellenarPlantilla(p.texto, valores) };
}

/**
 * Prepara un mensaje para abrirlo en WhatsApp: lo deja anotado en su ficha, marca el aviso como atendido y devuelve
 * el enlace que abre WhatsApp con el texto escrito. Nada se envía solo.
 */
export async function prepararMensaje(usuarioId: string, d: PeticionMensaje): Promise<Preparado> {
  const m = await componer(d);
  if (!m.ok) return m;
  await db().transaction(async (tx) => {
    await tx.insert(mensajes).values({ clienteId: m.clienta.id, telefono: m.telefono, plantilla: m.plantilla.clave, texto: m.texto, canal: "whatsapp_enlace", usuarioId, citaId: d.citaId });
    if (d.clave) await atenderAviso(d.clave, usuarioId, null, tx);
    await registrarActividad(tx, { usuarioId, accion: "mensaje.preparar", entidad: "clientes", entidadId: m.clienta.id, despues: { plantilla: m.plantilla.clave } });
  });
  return { ok: true, enlace: enlaceWhatsapp(m.telefono, m.texto), texto: m.texto };
}

export type Enviado = { ok: true; mensajeId: string } | { ok: false; error: string };

/**
 * Envía una plantilla aprobada por la API de WhatsApp. Queda en la ficha con su estado (enviado, entregado, leído o
 * fallido). El mismo aviso de una cita no se envía dos veces. `usuarioId` vacío = lo envió la app sola.
 */
export async function enviarPlantilla(usuarioId: string | null, d: PeticionMensaje & { campanaId?: string }): Promise<Enviado> {
  if (!apiWhatsapp()) return { ok: false, error: "WhatsApp automático no está configurado en este equipo." };
  const m = await componer(d);
  if (!m.ok) return m;
  const meta = plantillaMeta(m.plantilla);
  if (!meta) return { ok: false, error: `«${m.plantilla.nombre}» aún no está aprobada en Meta.` };

  let id: string;
  try {
    const [fila] = await db()
      .insert(mensajes)
      .values({
        clienteId: m.clienta.id,
        telefono: m.telefono,
        plantilla: m.plantilla.clave,
        texto: m.texto,
        canal: "whatsapp_api",
        usuarioId,
        citaId: d.citaId,
        campanaId: d.campanaId,
        estado: "enviando",
        estadoEn: new Date(),
      })
      .returning({ id: mensajes.id });
    id = fila!.id;
  } catch (e) {
    if (String((e as { cause?: { code?: string } }).cause?.code) === "23505") return { ok: false, error: `Ya se le ha enviado este mensaje a ${m.clienta.nombre}.` };
    throw e;
  }

  const r = await llamarMeta(cuerpoPlantilla(m.telefono, meta, m.valores));
  await db().transaction(async (tx) => {
    await tx
      .update(mensajes)
      .set(r.ok ? { waId: r.waId, estado: "enviado", estadoEn: new Date() } : { estado: "fallido", estadoEn: new Date(), error: r.error })
      .where(eq(mensajes.id, id));
    if (r.ok && d.clave && usuarioId) await atenderAviso(d.clave, usuarioId, null, tx);
    await registrarActividad(tx, {
      usuarioId,
      accion: "mensaje.enviar",
      entidad: "clientes",
      entidadId: m.clienta.id,
      despues: { plantilla: m.plantilla.clave, ...(r.ok ? {} : { error: r.error }) },
    });
  });
  return r.ok ? { ok: true, mensajeId: id } : { ok: false, error: `No se pudo enviar a ${m.clienta.nombre}: ${r.error}` };
}
