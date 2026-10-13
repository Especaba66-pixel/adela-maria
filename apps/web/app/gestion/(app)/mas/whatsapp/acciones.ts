"use server";
import { campanas, centro, plantillas, registrarActividad } from "@adela/db";
import { SEGMENTOS, VARIABLES_PLANTILLA, separarVariables, validarPlantilla, validarPlantillaMeta, type CategoriaMeta, type Segmento } from "@adela/dominio";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { clientasDeSegmento } from "@/server/clientas";
import { enviable, enviarPlantilla } from "@/server/mensajes";
import { responderTexto } from "@/server/whatsapp";

export type Estado = { ok: true; mensaje: string } | { ok: false; error: string } | null;

export async function guardarPlantilla(_: Estado, f: FormData): Promise<Estado> {
  const { usuario } = await requerirSesion("configuracion.gestionar");
  const clave = String(f.get("clave") ?? "");
  const texto = String(f.get("texto") ?? "").trim();
  const e = validarPlantilla(texto);
  if (e) return { ok: false, error: e };
  await db().transaction(async (tx) => {
    const [p] = await tx.update(plantillas).set({ texto, actualizadaEn: new Date() }).where(eq(plantillas.clave, clave)).returning();
    if (!p) throw new Error("No existe la plantilla");
    await registrarActividad(tx, { usuarioId: usuario.id, accion: "plantilla.editar", entidad: "plantillas", despues: { clave, texto } });
  });
  revalidatePath("/gestion", "layout");
  return { ok: true, mensaje: "Guardado." };
}

/** Envía por la API un mensaje aprobado (desde un aviso o desde la ficha). */
export async function enviarMensaje(_: Estado, f: FormData): Promise<Estado> {
  const { usuario } = await requerirSesion("clientas.gestionar");
  const opcional = (k: string) => String(f.get(k) ?? "") || undefined;
  const r = await enviarPlantilla(usuario.id, {
    clienteId: String(f.get("cliente") ?? ""),
    plantilla: String(f.get("plantilla") ?? ""),
    citaId: opcional("cita"),
    bonoId: opcional("bono"),
    clave: opcional("clave"),
  });
  revalidatePath("/gestion", "layout");
  return r.ok ? { ok: true, mensaje: "Enviado." } : { ok: false, error: r.error };
}

/** Contesta con texto libre a una clienta que ha escrito en las últimas 24 horas. */
export async function responder(_: Estado, f: FormData): Promise<Estado> {
  const { usuario } = await requerirSesion("clientas.gestionar");
  const r = await responderTexto(usuario.id, String(f.get("cliente") ?? ""), String(f.get("texto") ?? ""));
  revalidatePath("/gestion", "layout");
  return r.ok ? { ok: true, mensaje: "Enviado." } : { ok: false, error: r.error };
}

/** Datos de la plantilla aprobada en Meta (vacío el nombre = no se envía sola). */
export async function guardarMeta(_: Estado, f: FormData): Promise<Estado> {
  const { usuario } = await requerirSesion("configuracion.gestionar");
  const clave = String(f.get("clave") ?? "");
  const d = {
    nombre: String(f.get("metaNombre") ?? "").trim(),
    idioma: String(f.get("metaIdioma") ?? "es").trim() || "es",
    variables: String(f.get("metaVariables") ?? ""),
    categoria: String(f.get("metaCategoria") ?? ""),
  };
  const botones = f.get("metaBotones") === "on";
  if (d.nombre) {
    const e = validarPlantillaMeta(d, VARIABLES_PLANTILLA);
    if (e) return { ok: false, error: e };
  }
  const valores = d.nombre
    ? { metaNombre: d.nombre, metaIdioma: d.idioma, metaCategoria: d.categoria as CategoriaMeta, metaVariables: separarVariables(d.variables), metaBotones: botones }
    : { metaNombre: null, metaCategoria: null, metaVariables: [], metaBotones: false };
  await db().transaction(async (tx) => {
    const [p] = await tx.update(plantillas).set(valores).where(eq(plantillas.clave, clave)).returning();
    if (!p) throw new Error("No existe la plantilla");
    await registrarActividad(tx, { usuarioId: usuario.id, accion: "plantilla.meta", entidad: "plantillas", despues: { clave, ...valores } });
  });
  revalidatePath("/gestion", "layout");
  return { ok: true, mensaje: d.nombre ? "Guardado: ya se puede enviar desde la app." : "Guardado: se envía abriendo WhatsApp." };
}

const aMinutos = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  return m && Number(m[1]) <= 24 && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export async function guardarAutomatico(_: Estado, f: FormData): Promise<Estado> {
  const { usuario } = await requerirSesion("configuracion.gestionar");
  const desde = aMinutos(String(f.get("desde") ?? ""));
  const hasta = aMinutos(String(f.get("hasta") ?? ""));
  if (desde === null || hasta === null || desde >= hasta) return { ok: false, error: "Revisa la franja: «desde» tiene que ser antes que «hasta»." };
  const valor = { recordatorios: f.get("recordatorios") === "on", seguimiento: f.get("seguimiento") === "on", desde, hasta };
  await db().transaction(async (tx) => {
    await tx.update(centro).set({ whatsapp: valor });
    await registrarActividad(tx, { usuarioId: usuario.id, accion: "whatsapp.configurar", entidad: "centro", despues: valor });
  });
  revalidatePath("/gestion", "layout");
  return { ok: true, mensaje: "Guardado." };
}

/** Envía un mensaje de promoción a un grupo de clientas: solo a las que lo aceptan y tienen teléfono. */
export async function enviarCampana(_: Estado, f: FormData): Promise<Estado> {
  const { usuario } = await requerirSesion("configuracion.gestionar");
  const segmento = String(f.get("segmento") ?? "") as Segmento;
  const clave = String(f.get("plantilla") ?? "");
  if (!(SEGMENTOS as readonly string[]).includes(segmento)) return { ok: false, error: "Elige el grupo." };
  const [p] = await db().select().from(plantillas).where(eq(plantillas.clave, clave));
  if (!p || p.permiso !== "promocion" || !enviable(p)) return { ok: false, error: "Elige un mensaje de promoción aprobado en Meta." };
  const destino = (await clientasDeSegmento(segmento)).filter((c) => c.telefono && c.promociones);
  if (!destino.length) return { ok: false, error: "Nadie de ese grupo acepta promociones." };
  const [campana] = await db().insert(campanas).values({ segmento, plantilla: clave, total: destino.length, usuarioId: usuario.id }).returning();
  await registrarActividad(db(), { usuarioId: usuario.id, accion: "campana.enviar", entidad: "campanas", entidadId: campana!.id, despues: { segmento, plantilla: clave, total: destino.length } });
  let bien = 0;
  for (const c of destino) if ((await enviarPlantilla(usuario.id, { clienteId: c.id, plantilla: clave, campanaId: campana!.id })).ok) bien++;
  revalidatePath("/gestion", "layout");
  const mal = destino.length - bien;
  return { ok: true, mensaje: `Enviado a ${bien} ${bien === 1 ? "clienta" : "clientas"}${mal ? `; ${mal} no se ${mal === 1 ? "pudo" : "pudieron"} enviar` : ""}.` };
}
