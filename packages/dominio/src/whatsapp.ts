/**
 * WhatsApp automático con la API oficial de Meta (WhatsApp Business Platform).
 *
 * La app manda plantillas aprobadas por Meta y recibe por webhooks los estados (enviado, entregado, leído, fallido)
 * y las respuestas de las clientas. Aquí están las reglas puras: leer lo que manda Meta, entender una respuesta y
 * decidir cuándo se puede enviar.
 */
import { normalizarTelefono } from "./reservas";

// ── Estados de un envío ──────────────────────────────────────────────────────

export const ESTADOS_ENVIO = ["enviando", "enviado", "entregado", "leido", "fallido"] as const;
export type EstadoEnvio = (typeof ESTADOS_ENVIO)[number];

export const NOMBRE_ESTADO_ENVIO: Record<EstadoEnvio, string> = {
  enviando: "Enviando",
  enviado: "Enviado",
  entregado: "Entregado",
  leido: "Leído",
  fallido: "No se pudo enviar",
};

/**
 * Meta puede mandar los estados desordenados (un «leído» antes que el «entregado»). Un estado solo sustituye al que
 * hay si va más adelante; un fallo cuenta siempre, salvo que el mensaje ya se haya entregado o leído.
 */
export function estadoSiguiente(actual: EstadoEnvio, nuevo: EstadoEnvio): EstadoEnvio {
  if (nuevo === "fallido") return actual === "entregado" || actual === "leido" ? actual : "fallido";
  if (actual === "fallido") return nuevo === "entregado" || nuevo === "leido" ? nuevo : actual;
  return ESTADOS_ENVIO.indexOf(nuevo) > ESTADOS_ENVIO.indexOf(actual) ? nuevo : actual;
}

// ── Lo que llega de Meta (webhooks) ──────────────────────────────────────────

export type EventoWhatsapp =
  | { tipo: "estado"; waId: string; estado: Exclude<EstadoEnvio, "enviando">; cuando: Date; error: string | null }
  | {
      tipo: "mensaje";
      waId: string;
      /** Teléfono de la clienta, como lo guarda la app (+34…) o, si no es español, con «+» delante. */
      telefono: string;
      nombre: string | null;
      cuando: Date;
      texto: string;
      /** Botón pulsado en una plantilla (CONFIRMAR, CAMBIAR…). */
      boton: string | null;
      /** Mensaje nuestro al que responde. */
      responde: string | null;
    };

const ESTADO_META: Record<string, Exclude<EstadoEnvio, "enviando">> = { sent: "enviado", delivered: "entregado", read: "leido", failed: "fallido" };

type Obj = Record<string, unknown>;
const obj = (x: unknown): Obj => (x && typeof x === "object" ? (x as Obj) : {});
const lista = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const texto = (x: unknown): string | null => (typeof x === "string" && x.length ? x : null);
const fechaMeta = (x: unknown) => {
  const s = Number(x);
  return Number.isFinite(s) && s > 0 ? new Date(s * 1000) : new Date();
};

/** Telefono de Meta («34611223344») al formato de la app. */
export function telefonoDeMeta(waId: string): string {
  return normalizarTelefono(`+${waId}`) ?? `+${waId.replace(/\D/g, "")}`;
}

/** Saca los estados y mensajes de un aviso de Meta. Lo que no entiende lo ignora (Meta añade campos con el tiempo). */
export function leerWebhook(cuerpo: unknown): EventoWhatsapp[] {
  const eventos: EventoWhatsapp[] = [];
  for (const entrada of lista(obj(cuerpo).entry)) {
    for (const cambio of lista(obj(entrada).changes)) {
      if (obj(cambio).field !== "messages") continue;
      const valor = obj(obj(cambio).value);
      const nombres = new Map(lista(valor.contacts).map((c) => [String(obj(c).wa_id), texto(obj(obj(c).profile).name)]));
      for (const s of lista(valor.statuses)) {
        const e = obj(s);
        const estado = ESTADO_META[String(e.status)];
        const waId = texto(e.id);
        if (!estado || !waId) continue;
        const err = obj(lista(e.errors)[0]);
        const detalle = texto(obj(err.error_data).details) ?? texto(err.message) ?? texto(err.title);
        eventos.push({ tipo: "estado", waId, estado, cuando: fechaMeta(e.timestamp), error: estado === "fallido" ? `${detalle ?? "Error"}${err.code ? ` (${err.code})` : ""}` : null });
      }
      for (const m of lista(valor.messages)) {
        const e = obj(m);
        const waId = texto(e.id);
        const de = texto(e.from);
        if (!waId || !de) continue;
        const boton = obj(e.button);
        const respuestaBoton = obj(obj(e.interactive).button_reply);
        const cuerpoTexto =
          texto(obj(e.text).body) ??
          texto(boton.text) ??
          texto(respuestaBoton.title) ??
          texto(obj(e.image).caption) ??
          (e.type ? `[${NOMBRE_TIPO[String(e.type)] ?? "mensaje"}]` : "[mensaje]");
        eventos.push({
          tipo: "mensaje",
          waId,
          telefono: telefonoDeMeta(de),
          nombre: nombres.get(de) ?? null,
          cuando: fechaMeta(e.timestamp),
          texto: cuerpoTexto.slice(0, 2000),
          boton: texto(boton.payload) ?? texto(respuestaBoton.id),
          responde: texto(obj(e.context).id),
        });
      }
    }
  }
  return eventos;
}

const NOMBRE_TIPO: Record<string, string> = {
  image: "foto",
  audio: "audio",
  voice: "audio",
  video: "vídeo",
  document: "documento",
  sticker: "sticker",
  location: "ubicación",
  contacts: "contacto",
  reaction: "reacción",
};

// ── Respuestas de las clientas ───────────────────────────────────────────────

export type IntencionRespuesta = "confirmar" | "cambiar" | "baja" | null;

/** Botones de las plantillas de cita (deben coincidir con los que se dan de alta en Meta, en este orden). */
export const BOTONES_CITA = ["CONFIRMAR", "CAMBIAR"] as const;

const sinAcentos = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[¡!¿?.,;:)(\s]+/g, " ")
    .trim();

/**
 * Qué quiere la clienta. Solo se entiende lo que no deja dudas: un botón, «baja», o un «sí / confirmo» corto. Todo lo
 * demás lo lee una persona.
 */
export function entenderRespuesta(texto: string, boton: string | null): IntencionRespuesta {
  if (boton === "CONFIRMAR") return "confirmar";
  if (boton === "CAMBIAR") return "cambiar";
  const t = sinAcentos(texto);
  if (/^(baja|stop|darme de baja|dar de baja|no quiero (recibir )?(mas )?mensajes)$/.test(t)) return "baja";
  if (/^(si|sii+|confirmo|confirmada|confirmado|ok|vale|perfecto|alli estare|si confirmo|si gracias|vale gracias|ok gracias|perfecto gracias)( 👍| 😊)*$/.test(t)) return "confirmar";
  if (/^(cambiar|quiero cambiar|cambiar (la )?cita|no puedo( ir)?|no podre( ir)?|anular|cancelar)$/.test(t)) return "cambiar";
  return null;
}

/** Se puede escribir texto libre (gratis) durante 24 horas desde el último mensaje de la clienta. */
export function ventanaAbierta(ultimoDeLaClienta: Date | null, ahora: Date): boolean {
  return ultimoDeLaClienta !== null && ahora.getTime() - ultimoDeLaClienta.getTime() < 24 * 3_600_000;
}

// ── Plantillas de Meta ───────────────────────────────────────────────────────

export const CATEGORIAS_META = ["utility", "marketing"] as const;
export type CategoriaMeta = (typeof CATEGORIAS_META)[number];
export const NOMBRE_CATEGORIA_META: Record<CategoriaMeta, string> = { utility: "Utilidad", marketing: "Marketing" };

/** Datos de la plantilla tal y como Meta la aprobó. */
export interface PlantillaMeta {
  nombre: string;
  idioma: string;
  categoria: CategoriaMeta;
  /** Qué variable nuestra va en {{1}}, {{2}}… */
  variables: string[];
  /** Si tiene los botones Confirmar / Cambiar. */
  botones: boolean;
}

/** Lo que se manda a Meta para enviar una plantilla. Meta no admite parámetros vacíos. */
export function cuerpoPlantilla(telefono: string, p: PlantillaMeta, valores: Record<string, string | undefined>, payloads: readonly string[] = BOTONES_CITA) {
  const components: unknown[] = [];
  if (p.variables.length) components.push({ type: "body", parameters: p.variables.map((v) => ({ type: "text", text: valores[v]?.trim() || "-" })) });
  if (p.botones) payloads.forEach((payload, i) => components.push({ type: "button", sub_type: "quick_reply", index: String(i), parameters: [{ type: "payload", payload }] }));
  return { messaging_product: "whatsapp", to: telefono.replace(/^\+/, ""), type: "template", template: { name: p.nombre, language: { code: p.idioma }, components } };
}

export function cuerpoTexto(telefono: string, texto: string) {
  return { messaging_product: "whatsapp", to: telefono.replace(/^\+/, ""), type: "text", text: { body: texto } };
}

/** Comprueba los datos de Meta que se escriben a mano en la app. */
export function validarPlantillaMeta(p: { nombre: string; idioma: string; variables: string; categoria: string }, permitidas: readonly string[]): string | null {
  if (!/^[a-z0-9_]{1,512}$/.test(p.nombre.trim())) return "El nombre en Meta va en minúsculas, sin espacios ni acentos (por ejemplo, recordatorio_cita).";
  if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(p.idioma.trim())) return "El idioma es un código como «es» o «es_ES».";
  if (!(CATEGORIAS_META as readonly string[]).includes(p.categoria)) return "Elige la categoría.";
  const vars = separarVariables(p.variables);
  const mala = vars.find((v) => !permitidas.includes(v));
  if (mala) return `No existe la variable «${mala}». Puedes usar: ${permitidas.join(", ")}.`;
  return null;
}

/** «nombre, fecha, hora» → ["nombre", "fecha", "hora"]. */
export const separarVariables = (t: string) =>
  t
    .split(/[\s,;]+/)
    .map((v) => v.replace(/[{}]/g, "").trim())
    .filter(Boolean);

// ── Envío automático ─────────────────────────────────────────────────────────

export interface AjustesWhatsapp {
  /** Enviar solos los recordatorios del día siguiente. */
  recordatorios: boolean;
  /** Enviar solo el «qué tal» del día después. */
  seguimiento: boolean;
  /** Franja en la que se envía (minutos desde las 0:00, hora de Madrid). */
  desde: number;
  hasta: number;
}

export const AJUSTES_WHATSAPP_INICIALES: AjustesWhatsapp = { recordatorios: false, seguimiento: false, desde: 10 * 60, hasta: 20 * 60 };

export function leerAjustesWhatsapp(guardado: unknown): AjustesWhatsapp {
  const g = obj(guardado);
  const minutos = (v: unknown, d: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 24 * 60 ? (v as number) : d);
  const desde = minutos(g.desde, AJUSTES_WHATSAPP_INICIALES.desde);
  const hasta = minutos(g.hasta, AJUSTES_WHATSAPP_INICIALES.hasta);
  return {
    recordatorios: typeof g.recordatorios === "boolean" ? g.recordatorios : AJUSTES_WHATSAPP_INICIALES.recordatorios,
    seguimiento: typeof g.seguimiento === "boolean" ? g.seguimiento : AJUSTES_WHATSAPP_INICIALES.seguimiento,
    desde: Math.min(desde, hasta),
    hasta: Math.max(desde, hasta),
  };
}

/** ¿Es hora de enviar? (no se molesta a nadie de madrugada). */
export const dentroDeFranja = (a: AjustesWhatsapp, minutosMadrid: number) => minutosMadrid >= a.desde && minutosMadrid < a.hasta;
