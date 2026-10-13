import "server-only";
import { bonos, centro, clientes, mensajes, plantillas, registrarActividad } from "@adela/db";
import { enlaceWhatsapp, horaATexto, partesMadrid, rellenarPlantilla, textoQuedan } from "@adela/dominio";
import { eq, sql } from "drizzle-orm";
import { diaLargo } from "@/lib/fechas";
import { detalleCita } from "./agenda";
import { atenderAviso } from "./avisos";
import { db } from "./db";

export type Preparado = { ok: true; enlace: string; texto: string } | { ok: false; error: string };

/**
 * Prepara un mensaje de WhatsApp para una clienta a partir de una plantilla: lo deja anotado en su ficha, marca el
 * aviso como atendido y devuelve el enlace que abre WhatsApp con el texto escrito. Nada se envía solo.
 */
export async function prepararMensaje(
  usuarioId: string,
  d: { clienteId: string; plantilla: string; citaId?: string; bonoId?: string; clave?: string },
): Promise<Preparado> {
  const [[c], [p], [centroDatos]] = await Promise.all([
    db().select().from(clientes).where(eq(clientes.id, d.clienteId)),
    db().select().from(plantillas).where(eq(plantillas.clave, d.plantilla)),
    db().select({ nombre: centro.nombre }).from(centro).limit(1),
  ]);
  if (!c || c.anonimizadaEn || !p) return { ok: false, error: "No se encuentra la clienta o el mensaje." };
  if (!c.telefono) return { ok: false, error: `${c.nombre} no tiene teléfono.` };
  // Confirmar lo que ella misma pidió no necesita permiso; lo demás, el que corresponda.
  if (d.plantilla !== "confirmar_cita") {
    if (p.permiso === "cita" && !c.aceptaAvisosCitas) return { ok: false, error: `${c.nombre} no ha dado permiso para avisos de citas.` };
    if (p.permiso === "promocion" && !c.aceptaPromociones) return { ok: false, error: `${c.nombre} no ha dado permiso para promociones.` };
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
  const texto = rellenarPlantilla(p.texto, valores);

  await db().transaction(async (tx) => {
    await tx.insert(mensajes).values({ clienteId: c.id, plantilla: p.clave, texto, canal: "whatsapp_enlace", usuarioId });
    if (d.clave) await atenderAviso(d.clave, usuarioId, null, tx);
    await registrarActividad(tx, { usuarioId, accion: "mensaje.preparar", entidad: "clientes", entidadId: c.id, despues: { plantilla: p.clave } });
  });
  return { ok: true, enlace: enlaceWhatsapp(c.telefono, texto), texto };
}

