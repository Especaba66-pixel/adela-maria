/**
 * Reservas por internet de Adela María, en Cloudflare (gratis, siempre encendido aunque el TPV esté apagado).
 *
 * Para la web (sin claves):
 *   GET  /api/servicios                         tratamientos que se pueden reservar
 *   GET  /api/disponibilidad?servicio&desde&dias horas libres de esos días
 *   POST /api/reservas                          reservar una hora (queda «por confirmar» en el centro)
 *
 * Para el TPV (con la clave de sincronización):
 *   GET  /api/sync/reservas                     reservas nuevas que el TPV aún no se ha llevado
 *   POST /api/sync                              el TPV manda tratamientos, horario, cabinas y lo ocupado
 *   GET  /api/sync/whatsapp                     avisos de WhatsApp que el TPV aún no se ha llevado
 *   POST /api/sync/whatsapp                     { hasta }: el TPV ya los tiene; se borran
 *
 * Para Meta (firmado con el secreto de la app):
 *   GET  /api/whatsapp                          alta del webhook
 *   POST /api/whatsapp                          estados de los envíos y mensajes de las clientas
 */
import { esFecha, sumarDias } from "@adela/dominio/agenda";
import { MAX_PENDIENTES_POR_TELEFONO, TEXTO_PRIVACIDAD, validarSolicitud } from "@adela/dominio/reservas";
import { MAX_CUERPO, firmaValida, verificarSuscripcion } from "./whatsapp";
import { estaLibre, horasLibres, intervalo, type Estado, type Ocupa, type Servicio } from "./disponibilidad";

export interface Env {
  DB: D1Database;
  /** Webs que pueden usar la API, separadas por comas («*» = cualquiera). */
  ORIGEN_WEB: string;
  /** Clave que usa el TPV para sincronizar (secreto de Cloudflare). */
  CLAVE_SYNC: string;
  /** Secreto de la app de Meta, para comprobar que los avisos de WhatsApp vienen de Meta. */
  WA_SECRETO_APP?: string;
  /** Token que se escribe en Meta al dar de alta el webhook. */
  WA_TOKEN_VERIFICACION?: string;
}

/** Reservas por hora desde una misma conexión (frena el abuso). */
const MAX_POR_IP_HORA = 5;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const cors = cabecerasCors(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const r = await enrutar(req, url, env);
      for (const [k, v] of Object.entries(cors)) r.headers.set(k, v);
      return r;
    } catch (e) {
      console.error(e);
      return json({ error: "Algo ha fallado. Prueba otra vez o escríbenos por WhatsApp." }, 500, cors);
    }
  },
} satisfies ExportedHandler<Env>;

async function enrutar(req: Request, url: URL, env: Env): Promise<Response> {
  const ruta = url.pathname.replace(/\/+$/, "");
  if (req.method === "GET" && ruta === "/api/servicios") return json({ servicios: await servicios(env) });
  if (req.method === "GET" && ruta === "/api/disponibilidad") return disponibilidad(url, env);
  if (req.method === "POST" && ruta === "/api/reservas") return reservar(req, env);
  if (ruta === "/api/whatsapp") {
    if (req.method === "GET") {
      const reto = verificarSuscripcion(url, env.WA_TOKEN_VERIFICACION ?? "");
      return reto === null ? json({ error: "No autorizado" }, 403) : new Response(reto, { headers: { "Content-Type": "text/plain" } });
    }
    if (req.method === "POST") return recibirWhatsapp(req, env);
  }
  if (ruta.startsWith("/api/sync")) {
    if (!(await claveCorrecta(req, env))) return json({ error: "No autorizado" }, 401);
    if (req.method === "GET" && ruta === "/api/sync/whatsapp") return eventosWhatsapp(env);
    if (req.method === "POST" && ruta === "/api/sync/whatsapp") return borrarEventosWhatsapp(req, env);
    if (req.method === "GET" && ruta === "/api/sync/reservas") return pendientesDeImportar(env);
    if (req.method === "POST" && ruta === "/api/sync") return sincronizar(req, env);
  }
  return json({ error: "No existe" }, 404);
}

// ── Web ──────────────────────────────────────────────────────────────────────

async function servicios(env: Env): Promise<Servicio[]> {
  const { results } = await env.DB.prepare("SELECT id, nombre, categoria, duracion, exclusivo, precio FROM servicios ORDER BY orden, nombre").all<
    Omit<Servicio, "exclusivo"> & { exclusivo: number }
  >();
  return results.map((s) => ({ ...s, exclusivo: Boolean(s.exclusivo) }));
}

async function servicio(env: Env, id: string): Promise<Servicio | null> {
  const s = await env.DB.prepare("SELECT id, nombre, categoria, duracion, exclusivo, precio FROM servicios WHERE id = ?")
    .bind(id)
    .first<Omit<Servicio, "exclusivo"> & { exclusivo: number }>();
  return s ? { ...s, exclusivo: Boolean(s.exclusivo) } : null;
}

/** Horario, cabinas y todo lo que ocupa entre dos instantes (citas del TPV, bloqueos y reservas web aún no importadas). */
async function estado(env: Env, desde: number, hasta: number): Promise<Estado & { version: string }> {
  const [horario, ajustes, ocupado, reservas] = await env.DB.batch([
    env.DB.prepare("SELECT dia_semana AS diaSemana, inicio, fin FROM horario"),
    env.DB.prepare("SELECT clave, valor FROM ajustes WHERE clave IN ('cabinas', 'version')"),
    env.DB.prepare("SELECT inicio, fin, exclusiva, bloqueo FROM ocupado WHERE inicio < ? AND fin > ?").bind(hasta, desde),
    env.DB.prepare("SELECT inicio, fin, exclusiva, 0 AS bloqueo FROM reservas WHERE importada = 0 AND inicio < ? AND fin > ?").bind(hasta, desde),
  ]);
  const a = new Map((ajustes!.results as { clave: string; valor: string }[]).map((x) => [x.clave, x.valor]));
  const aOcupa = (o: Record<string, number>): Ocupa => ({ inicio: o.inicio!, fin: o.fin!, exclusiva: Boolean(o.exclusiva), bloqueo: Boolean(o.bloqueo) });
  return {
    horario: horario!.results as Estado["horario"],
    cabinas: Math.max(1, Number(a.get("cabinas") ?? 1)),
    version: a.get("version") ?? "0",
    ocupado: [...(ocupado!.results as Record<string, number>[]), ...(reservas!.results as Record<string, number>[])].map(aOcupa),
  };
}

async function disponibilidad(url: URL, env: Env): Promise<Response> {
  const s = await servicio(env, url.searchParams.get("servicio") ?? "");
  if (!s) return json({ error: "Elige el tratamiento." }, 400);
  const desde = url.searchParams.get("desde") ?? "";
  const dias = Math.min(Math.max(Number(url.searchParams.get("dias") ?? 7), 1), 31);
  if (!esFecha(desde)) return json({ error: "Fecha no válida." }, 400);
  const fechas = Array.from({ length: dias }, (_, i) => sumarDias(desde, i));
  const e = await estado(env, intervalo(desde, 0, 0).inicio, intervalo(sumarDias(desde, dias), 0, 0).inicio);
  const ahora = new Date();
  return json({ dias: fechas.map((fecha) => ({ fecha, horas: horasLibres(e, s, fecha, ahora) })) });
}

interface PeticionReserva {
  servicio?: string;
  fecha?: string;
  minutos?: number;
  nombre?: string;
  telefono?: string;
  nota?: string;
  acepta?: boolean;
  /** Campo trampa: las personas no lo ven; los robots lo rellenan. */
  web?: string;
}

async function reservar(req: Request, env: Env): Promise<Response> {
  const p = (await req.json().catch(() => ({}))) as PeticionReserva;
  if (p.web) return json({ ok: true });
  const s = await servicio(env, String(p.servicio ?? ""));
  if (!s) return json({ error: "Elige el tratamiento." }, 400);
  const v = validarSolicitud(
    {
      tratamientoId: s.id,
      fechaPreferida: String(p.fecha ?? ""),
      franja: "indiferente",
      nombre: String(p.nombre ?? ""),
      telefono: String(p.telefono ?? ""),
      nota: String(p.nota ?? ""),
      aceptaPrivacidad: p.acepta === true,
    },
    new Date(),
  );
  if (!v.ok) return json({ error: v.error }, 400);
  const fecha = v.datos.fechaPreferida;
  const minutos = Number(p.minutos);
  if (!Number.isInteger(minutos)) return json({ error: "Elige la hora." }, 400);

  const ip = req.headers.get("CF-Connecting-IP") ?? "";
  const hace1h = Date.now() - 3_600_000;
  const [porIp, porTelefono] = await env.DB.batch([
    env.DB.prepare("SELECT count(*) AS n FROM reservas WHERE ip = ? AND creada > ?").bind(ip, hace1h),
    env.DB.prepare("SELECT count(*) AS n FROM reservas WHERE importada = 0 AND telefono = ?").bind(v.datos.telefono),
  ]);
  if (ip && (porIp!.results[0] as { n: number }).n >= MAX_POR_IP_HORA) {
    return json({ error: "Has hecho muchas reservas seguidas. Si necesitas más, escríbenos por WhatsApp." }, 429);
  }
  if ((porTelefono!.results[0] as { n: number }).n >= MAX_PENDIENTES_POR_TELEFONO) {
    return json({ error: "Ya tienes varias citas por confirmar. Te contestaremos enseguida; si es urgente, escríbenos por WhatsApp." }, 429);
  }

  const { inicio, fin } = intervalo(fecha, minutos, s.duracion);
  const id = crypto.randomUUID();
  // Se guarda solo si nadie ha tocado la agenda desde que se comprobó la hora (si no, se vuelve a comprobar).
  for (let intento = 0; intento < 5; intento++) {
    const e = await estado(env, inicio - 86_400_000, fin + 86_400_000);
    if (!estaLibre(e, s, fecha, minutos, new Date())) return json({ error: "Esa hora acaba de ocuparse. Elige otra, por favor." }, 409);
    const [, insertada] = await env.DB.batch([
      env.DB.prepare("UPDATE ajustes SET valor = CAST(valor AS INTEGER) + 1 WHERE clave = 'version' AND valor = ?").bind(e.version),
      env.DB.prepare(
        `INSERT INTO reservas (id, servicio_id, servicio_nombre, inicio, fin, exclusiva, nombre, telefono, nota, consentimiento, ip, creada)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`,
      ).bind(id, s.id, s.nombre, inicio, fin, s.exclusivo ? 1 : 0, v.datos.nombre, v.datos.telefono, v.datos.nota, TEXTO_PRIVACIDAD, ip, Date.now()),
    ]);
    if (insertada!.meta.changes === 1) return json({ ok: true, id }, 201);
  }
  return json({ error: "Hay mucha gente reservando ahora mismo. Prueba otra vez en un momento." }, 503);
}

// ── TPV ──────────────────────────────────────────────────────────────────────

async function claveCorrecta(req: Request, env: Env): Promise<boolean> {
  const dada = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!env.CLAVE_SYNC || env.CLAVE_SYNC.length < 32 || !dada) return false;
  // Comparación en tiempo constante (sobre las huellas, para que la longitud tampoco cuente).
  const [a, b] = await Promise.all([dada, env.CLAVE_SYNC].map((t) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(t))));
  return crypto.subtle.timingSafeEqual(a!, b!);
}

async function pendientesDeImportar(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, servicio_id AS servicioId, servicio_nombre AS servicioNombre, inicio, fin, nombre, telefono, nota, consentimiento, creada
     FROM reservas WHERE importada = 0 ORDER BY creada`,
  ).all();
  return json({ reservas: results });
}

interface DatosSync {
  servicios: (Servicio & { orden: number })[];
  horario: { diaSemana: number; inicio: number; fin: number }[];
  cabinas: number;
  ocupado: Ocupa[];
  /** Reservas que el TPV ya ha pasado a su agenda (ya cuentan dentro de `ocupado`). */
  importadas: string[];
}

function datosSyncValidos(d: Partial<DatosSync>): d is DatosSync {
  const entero = (n: unknown) => Number.isInteger(n);
  return (
    Array.isArray(d.servicios) &&
    d.servicios.every((s) => typeof s.id === "string" && typeof s.nombre === "string" && entero(s.duracion) && s.duracion > 0) &&
    Array.isArray(d.horario) &&
    d.horario.every((h) => entero(h.diaSemana) && entero(h.inicio) && entero(h.fin)) &&
    entero(d.cabinas) &&
    d.cabinas! >= 1 &&
    Array.isArray(d.ocupado) &&
    d.ocupado.every((o) => entero(o.inicio) && entero(o.fin)) &&
    Array.isArray(d.importadas) &&
    d.importadas.every((i) => typeof i === "string")
  );
}

async function sincronizar(req: Request, env: Env): Promise<Response> {
  const d = (await req.json().catch(() => ({}))) as Partial<DatosSync>;
  if (!datosSyncValidos(d)) return json({ error: "Datos de sincronización no válidos" }, 400);
  const db = env.DB;
  const ahora = Date.now();
  await db.batch([
    db.prepare("DELETE FROM servicios"),
    ...d.servicios.map((s) =>
      db
        .prepare("INSERT INTO servicios (id, nombre, categoria, duracion, exclusivo, precio, orden) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(s.id, s.nombre, s.categoria ?? "", s.duracion, s.exclusivo ? 1 : 0, s.precio ?? null, s.orden ?? 0),
    ),
    db.prepare("DELETE FROM horario"),
    ...d.horario.map((h) => db.prepare("INSERT INTO horario (dia_semana, inicio, fin) VALUES (?, ?, ?)").bind(h.diaSemana, h.inicio, h.fin)),
    db.prepare("DELETE FROM ocupado"),
    ...d.ocupado.map((o) =>
      db.prepare("INSERT INTO ocupado (inicio, fin, exclusiva, bloqueo) VALUES (?, ?, ?, ?)").bind(o.inicio, o.fin, o.exclusiva ? 1 : 0, o.bloqueo ? 1 : 0),
    ),
    // Las importadas ya están en la agenda del TPV: aquí se borran sus datos personales.
    ...d.importadas.map((id) =>
      db.prepare("UPDATE reservas SET importada = 1, nombre = NULL, telefono = NULL, nota = NULL, consentimiento = NULL, ip = NULL WHERE id = ?").bind(id),
    ),
    db.prepare("DELETE FROM reservas WHERE importada = 1 AND fin < ?").bind(ahora - 86_400_000),
    db.prepare("UPDATE ajustes SET valor = ? WHERE clave = 'cabinas'").bind(String(d.cabinas)),
    db.prepare("UPDATE ajustes SET valor = CAST(valor AS INTEGER) + 1 WHERE clave = 'version'"),
    db.prepare("UPDATE ajustes SET valor = ? WHERE clave = 'sincronizado'").bind(new Date(ahora).toISOString()),
  ]);
  return json({ ok: true });
}

// ── WhatsApp ─────────────────────────────────────────────────────────────────

async function recibirWhatsapp(req: Request, env: Env): Promise<Response> {
  const cuerpo = await req.text();
  if (cuerpo.length > MAX_CUERPO) return json({ error: "Demasiado grande" }, 413);
  if (!(await firmaValida(env.WA_SECRETO_APP ?? "", cuerpo, req.headers.get("X-Hub-Signature-256")))) return json({ error: "Firma no válida" }, 401);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO whatsapp_eventos (cuerpo, recibido) VALUES (?, ?)").bind(cuerpo, Date.now()),
    // Si el TPV no se los lleva en un mes (apagado mucho tiempo), no se guardan más.
    env.DB.prepare("DELETE FROM whatsapp_eventos WHERE recibido < ?").bind(Date.now() - 30 * 86_400_000),
  ]);
  // Meta reintenta si no se le contesta 200 enseguida.
  return json({ ok: true });
}

async function eventosWhatsapp(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare("SELECT id, cuerpo, recibido FROM whatsapp_eventos ORDER BY id LIMIT 200").all();
  return json({ eventos: results });
}

async function borrarEventosWhatsapp(req: Request, env: Env): Promise<Response> {
  const { hasta } = (await req.json().catch(() => ({}))) as { hasta?: number };
  if (!Number.isInteger(hasta)) return json({ error: "Falta hasta" }, 400);
  await env.DB.prepare("DELETE FROM whatsapp_eventos WHERE id <= ?").bind(hasta).run();
  return json({ ok: true });
}

// ── Respuestas ───────────────────────────────────────────────────────────────

function json(cuerpo: unknown, estado = 200, cabeceras: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cabeceras },
  });
}

function cabecerasCors(req: Request, env: Env): Record<string, string> {
  const origen = req.headers.get("Origin") ?? "";
  const permitidos = (env.ORIGEN_WEB ?? "").split(",").map((o) => o.trim());
  const vale = permitidos.includes("*") || permitidos.includes(origen);
  return vale && origen
    ? { "Access-Control-Allow-Origin": origen, "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" }
    : {};
}
