import "server-only";
import { avisosAtendidos, centro, plantillas, citas, clientes, consentimientos, mensajes, registrarActividad } from "@adela/db";
import {
  cuerpoTexto,
  dentroDeFranja,
  entenderRespuesta,
  estadoSiguiente,
  hoyEnMadrid,
  leerAjustesWhatsapp,
  leerWebhook,
  partesMadrid,
  sumarDias,
  ventanaAbierta,
  type EventoWhatsapp,
  formatearTelefono,
} from "@adela/dominio";
import { and, desc, eq, gt, inArray, isNotNull, isNull } from "drizzle-orm";
import { cambiarEstadoCita, citasDelDia } from "./agenda";
import { db } from "./db";
import { enviarPlantilla, plantillaMeta } from "./mensajes";
import { avisar } from "./notificaciones";

/**
 * WhatsApp automático (API oficial de Meta). El TPV envía; los estados y las respuestas llegan a Cloudflare (siempre
 * encendido) y el TPV se los trae al sincronizar, cada minuto.
 */

export const apiWhatsapp = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_NUMERO_ID);
const urlApi = () => (process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v23.0").replace(/\/+$/, "");

/** Llama a Meta para enviar un mensaje. Devuelve el identificador del mensaje (wamid) o el motivo del fallo. */
export async function llamarMeta(cuerpo: unknown): Promise<{ ok: true; waId: string } | { ok: false; error: string }> {
  try {
    const r = await fetch(`${urlApi()}/${process.env.WHATSAPP_NUMERO_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(20_000),
    });
    const j = (await r.json().catch(() => ({}))) as { messages?: { id?: string }[]; error?: { message?: string; code?: number; error_data?: { details?: string } } };
    const waId = j.messages?.[0]?.id;
    if (r.ok && waId) return { ok: true, waId };
    const e = j.error;
    return { ok: false, error: `${e?.error_data?.details ?? e?.message ?? `Meta respondió ${r.status}`}${e?.code ? ` (${e.code})` : ""}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? "Meta no responde" : "Sin conexión con Meta" };
  }
}

export async function ajustesWhatsapp() {
  const [c] = await db().select({ whatsapp: centro.whatsapp }).from(centro).limit(1);
  return leerAjustesWhatsapp(c?.whatsapp);
}

/** Último mensaje que escribió la clienta (abre 24 horas para contestarle con texto libre, sin coste). */
export async function ultimoDeLaClienta(clienteId: string): Promise<Date | null> {
  const [m] = await db()
    .select({ cuando: mensajes.cuando })
    .from(mensajes)
    .where(and(eq(mensajes.clienteId, clienteId), eq(mensajes.direccion, "entrante")))
    .orderBy(desc(mensajes.cuando))
    .limit(1);
  return m?.cuando ?? null;
}

/** Texto libre a una clienta que ha escrito en las últimas 24 horas. */
export async function responderTexto(usuarioId: string | null, clienteId: string, texto: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = texto.trim();
  if (t.length < 1 || t.length > 4000) return { ok: false, error: "Escribe el mensaje." };
  if (!apiWhatsapp()) return { ok: false, error: "WhatsApp automático no está configurado en este equipo." };
  const [c] = await db().select().from(clientes).where(eq(clientes.id, clienteId));
  if (!c?.telefono || c.anonimizadaEn) return { ok: false, error: "Esta clienta no tiene teléfono." };
  if (!ventanaAbierta(await ultimoDeLaClienta(clienteId), new Date())) {
    return { ok: false, error: "Solo se puede escribir texto libre en las 24 horas siguientes a un mensaje suyo. Usa un mensaje aprobado." };
  }
  const r = await llamarMeta(cuerpoTexto(c.telefono, t));
  await db().transaction(async (tx) => {
    await tx.insert(mensajes).values({
      clienteId,
      telefono: c.telefono,
      texto: t,
      canal: "whatsapp_api",
      usuarioId,
      ...(r.ok ? { waId: r.waId, estado: "enviado" as const } : { estado: "fallido" as const, error: r.error }),
      estadoEn: new Date(),
    });
    if (usuarioId) await registrarActividad(tx, { usuarioId, accion: "mensaje.enviar", entidad: "clientes", entidadId: clienteId, despues: { texto: "libre" } });
  });
  return r.ok ? { ok: true } : { ok: false, error: `No se pudo enviar: ${r.error}` };
}

// ── Lo que llega de Meta ─────────────────────────────────────────────────────

/** Procesa los avisos de Meta guardados en Cloudflare. Se puede repetir sin miedo: nada se aplica dos veces. */
export async function procesarEventos(cuerpos: string[]): Promise<number> {
  let n = 0;
  for (const cuerpo of cuerpos) {
    let datos: unknown;
    try {
      datos = JSON.parse(cuerpo);
    } catch {
      continue;
    }
    for (const e of leerWebhook(datos)) {
      if (e.tipo === "estado") await aplicarEstado(e);
      else await recibirMensaje(e);
      n++;
    }
  }
  return n;
}

async function aplicarEstado(e: Extract<EventoWhatsapp, { tipo: "estado" }>) {
  const [m] = await db().select().from(mensajes).where(eq(mensajes.waId, e.waId));
  if (!m?.estado) return;
  const nuevo = estadoSiguiente(m.estado, e.estado);
  if (nuevo === m.estado) return;
  await db()
    .update(mensajes)
    .set({ estado: nuevo, estadoEn: e.cuando, ...(nuevo === "fallido" ? { error: e.error } : {}) })
    .where(eq(mensajes.id, m.id));
}

async function recibirMensaje(e: Extract<EventoWhatsapp, { tipo: "mensaje" }>) {
  const [c] = await db()
    .select()
    .from(clientes)
    .where(and(eq(clientes.telefono, e.telefono), isNull(clientes.anonimizadaEn)));
  const [m] = await db()
    .insert(mensajes)
    .values({ clienteId: c?.id ?? null, telefono: e.telefono, direccion: "entrante", texto: e.texto, canal: "whatsapp_api", waId: e.waId, boton: e.boton, responde: e.responde, cuando: e.cuando })
    .onConflictDoNothing()
    .returning();
  if (!m) return; // repetido: ya se trató
  if (!c) {
    // Un número sin ficha: lo verá una persona.
    await avisar({ titulo: "Mensaje de un número sin ficha", texto: `${e.telefono.startsWith("+34") ? formatearTelefono(e.telefono) : e.telefono}: ${e.texto}`, url: "/gestion" }, "clientas.gestionar");
    return;
  }

  const intencion = entenderRespuesta(e.texto, e.boton);
  const nombre = c.nombre.trim().split(/\s+/)[0] ?? c.nombre;
  const resuelto = async () => {
    await db().insert(avisosAtendidos).values({ clave: `respuesta:${m.id}`, posponerHasta: null, usuarioId: null }).onConflictDoNothing();
  };

  if (intencion === "confirmar") {
    const cita = await citaQueResponde(c.id, e.responde);
    if (!cita) {
      // No se sabe qué confirma: lo lee una persona.
      await avisar({ titulo: `Mensaje de ${c.nombre}`, texto: e.texto, url: `/gestion/clientas/${c.id}` }, "clientas.gestionar");
      return;
    }
    if (cita.estado === "pendiente") await cambiarEstadoCita(cita.id, "confirmada", null);
    await db().update(citas).set({ confirmadaPorClientaEn: e.cuando }).where(eq(citas.id, cita.id));
    await registrarActividad(db(), { usuarioId: null, accion: "cita.confirmada_por_clienta", entidad: "citas", entidadId: cita.id, despues: { canal: "whatsapp" } });
    await resuelto();
    await responderTexto(null, c.id, `¡Gracias, ${nombre}! Tu cita queda confirmada. Te esperamos.`);
  } else if (intencion === "baja") {
    await db().transaction(async (tx) => {
      await tx.update(clientes).set({ aceptaAvisosCitas: false, aceptaPromociones: false }).where(eq(clientes.id, c.id));
      for (const tipo of ["avisos_citas", "promociones"] as const) {
        await tx.insert(consentimientos).values({ clienteId: c.id, tipo, aceptado: false, texto: `Pidió la baja respondiendo «${e.texto}» por WhatsApp.`, canal: "whatsapp" });
      }
      await registrarActividad(tx, { usuarioId: null, accion: "clienta.baja_whatsapp", entidad: "clientes", entidadId: c.id });
    });
    await resuelto();
    await responderTexto(null, c.id, `Hecho, ${nombre}: ya no te enviaremos mensajes automáticos. Si cambias de idea, dínoslo.`);
  } else {
    // «Cambiar» y lo demás quedan como aviso para el centro, y llegan al móvil.
    await avisar({ titulo: `Mensaje de ${c.nombre}`, texto: e.texto, url: `/gestion/clientas/${c.id}` }, "clientas.gestionar");
  }
}

/** La cita a la que responde: la del mensaje citado o, si no, la del último aviso de cita que se le envió. */
async function citaQueResponde(clienteId: string, responde: string | null) {
  const desde = new Date(Date.now() - 4 * 86_400_000);
  const [enviado] = await db()
    .select({ citaId: mensajes.citaId })
    .from(mensajes)
    .where(
      and(
        eq(mensajes.clienteId, clienteId),
        eq(mensajes.direccion, "saliente"),
        isNotNull(mensajes.citaId),
        inArray(mensajes.plantilla, ["recordatorio", "confirmar_cita"]),
        responde ? eq(mensajes.waId, responde) : gt(mensajes.cuando, desde),
      ),
    )
    .orderBy(desc(mensajes.cuando))
    .limit(1);
  if (!enviado?.citaId) return null;
  const [cita] = await db().select().from(citas).where(eq(citas.id, enviado.citaId));
  return cita && (cita.estado === "pendiente" || cita.estado === "confirmada") && cita.inicio > new Date() ? cita : null;
}

// ── Envío automático ─────────────────────────────────────────────────────────

/**
 * Envía solos los recordatorios de mañana y el «qué tal» de ayer, dentro de la franja horaria. Cada cita recibe cada
 * aviso una sola vez: si falla, sale en el Inicio para hacerlo a mano.
 */
export async function envioAutomatico(ahora = new Date()): Promise<{ enviados: number; fallidos: number }> {
  const r = { enviados: 0, fallidos: 0 };
  if (!apiWhatsapp()) return r;
  const a = await ajustesWhatsapp();
  if (!dentroDeFranja(a, partesMadrid(ahora).minutos)) return r;
  const hoy = hoyEnMadrid(ahora);
  const tandas: { plantilla: string; citas: Awaited<ReturnType<typeof citasDelDia>> }[] = [];
  if (a.recordatorios) tandas.push({ plantilla: "recordatorio", citas: (await citasDelDia(sumarDias(hoy, 1))).filter((c) => c.estado === "pendiente" || c.estado === "confirmada") });
  if (a.seguimiento) tandas.push({ plantilla: "seguimiento", citas: (await citasDelDia(sumarDias(hoy, -1))).filter((c) => c.estado === "realizada") });

  const aprobadas = new Set((await db().select().from(plantillas)).filter((p) => plantillaMeta(p)).map((p) => p.clave));
  for (const t of tandas) {
    if (!t.citas.length || !aprobadas.has(t.plantilla)) continue;
    const ya = new Set(
      (
        await db()
          .select({ citaId: mensajes.citaId })
          .from(mensajes)
          .where(and(eq(mensajes.canal, "whatsapp_api"), eq(mensajes.plantilla, t.plantilla), inArray(mensajes.citaId, t.citas.map((c) => c.id))))
      ).map((m) => m.citaId),
    );
    const fichas = await db().select().from(clientes).where(inArray(clientes.id, t.citas.map((c) => c.cliente.id)));
    for (const c of t.citas) {
      const f = fichas.find((x) => x.id === c.cliente.id);
      if (ya.has(c.id) || !f?.telefono || !f.aceptaAvisosCitas || f.anonimizadaEn) continue;
      const e = await enviarPlantilla(null, { clienteId: f.id, plantilla: t.plantilla, citaId: c.id });
      if (e.ok) r.enviados++;
      else if (!/Ya se le ha enviado/.test(e.error)) r.fallidos++;
    }
  }
  return r;
}
