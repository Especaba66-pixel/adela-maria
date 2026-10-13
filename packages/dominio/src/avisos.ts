/**
 * Avisos, tareas y seguimiento: lo que hay que hacer hoy, ordenado por urgencia, con el mensaje de WhatsApp ya
 * escrito cuando toca escribir a una clienta. Nada se envía solo: se abre WhatsApp y la persona pulsa enviar.
 */

export const PRIORIDADES = ["urgente", "importante", "pendiente", "informativo"] as const;
export type PrioridadAviso = (typeof PRIORIDADES)[number];

/** Para ordenar: urgente primero. */
export const ordenarPorPrioridad = <T extends { prioridad: PrioridadAviso }>(lista: T[]) =>
  [...lista].sort((a, b) => PRIORIDADES.indexOf(a.prioridad) - PRIORIDADES.indexOf(b.prioridad));

// ── Plantillas de mensajes ───────────────────────────────────────────────────

/**
 * Qué permiso de la clienta hace falta: «cita» (avisos de sus citas) o «promocion» (promociones y novedades).
 * Sin ese permiso no se ofrece el botón de WhatsApp.
 */
export type PermisoMensaje = "cita" | "promocion";

export interface Plantilla {
  clave: string;
  nombre: string;
  permiso: PermisoMensaje;
  texto: string;
}

export const VARIABLES_PLANTILLA = ["nombre", "centro", "fecha", "hora", "servicios", "quedan", "bono"] as const;

export const PLANTILLAS_INICIALES: Plantilla[] = [
  {
    clave: "confirmar_cita",
    nombre: "Confirmar una cita pedida en la web",
    permiso: "cita",
    texto: "Hola, {nombre}. Somos {centro}. Te confirmamos tu cita de {servicios} el {fecha} a las {hora}. ¡Te esperamos!",
  },
  {
    clave: "recordatorio",
    nombre: "Recordatorio de la cita de mañana",
    permiso: "cita",
    texto: "Hola, {nombre}. Te recordamos tu cita de {servicios} mañana, {fecha}, a las {hora} en {centro}. Si no puedes venir, avísanos, por favor. ¡Hasta mañana!",
  },
  {
    clave: "seguimiento",
    nombre: "Qué tal después del tratamiento",
    permiso: "cita",
    texto: "Hola, {nombre}. ¿Qué tal te encuentras después de tu {servicios}? Cualquier duda, aquí estamos. Un abrazo de {centro}.",
  },
  {
    clave: "renovar_bono",
    nombre: "Le queda una sesión del bono",
    permiso: "cita",
    texto: "Hola, {nombre}. Te queda {quedan} de tu {bono}. Si quieres seguir con el tratamiento, te reservamos ya la próxima cita o te preparamos un bono nuevo. {centro}",
  },
  {
    clave: "te_echamos_de_menos",
    nombre: "Hace tiempo que no viene",
    permiso: "promocion",
    texto: "Hola, {nombre}. ¡Hace tiempo que no te vemos por {centro}! Cuando quieras, te buscamos un hueco para cuidarte. Un abrazo.",
  },
  {
    clave: "cumpleanos",
    nombre: "Felicitación de cumpleaños",
    permiso: "promocion",
    texto: "¡Feliz cumpleaños, {nombre}! Todo el equipo de {centro} te desea un día precioso.",
  },
];

/** Rellena {variables}; las que no tienen valor se quitan (sin dejar huecos raros). */
export function rellenarPlantilla(texto: string, valores: Partial<Record<(typeof VARIABLES_PLANTILLA)[number], string>>): string {
  return texto
    .replace(/\{(\w+)\}/g, (_, v: string) => (valores as Record<string, string | undefined>)[v] ?? "")
    .replace(/ {2,}/g, " ")
    .replace(/ ([,.!?])/g, "$1")
    .trim();
}

export function validarPlantilla(texto: string): string | null {
  const t = texto.trim();
  if (t.length < 5) return "Escribe el mensaje.";
  if (t.length > 1000) return "El mensaje es demasiado largo (máximo 1000 caracteres).";
  const desconocidas = [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).filter((v) => !(VARIABLES_PLANTILLA as readonly string[]).includes(v));
  if (desconocidas.length) return `No existe {${desconocidas[0]}}. Puedes usar: ${VARIABLES_PLANTILLA.map((v) => `{${v}}`).join(", ")}.`;
  return null;
}

// ── Reglas ───────────────────────────────────────────────────────────────────

export interface AjustesAvisos {
  /** Recordar las citas del día siguiente. */
  recordatorios: boolean;
  /** Preguntar qué tal el día después del tratamiento. */
  seguimiento: boolean;
  /** Ofrecer renovar cuando a un bono le queda una sesión. */
  bonos: boolean;
  /** Días sin venir para considerar a una clienta inactiva (0 = no avisar). */
  diasInactiva: number;
  /** Felicitar los cumpleaños. */
  cumpleanos: boolean;
}

export const AJUSTES_AVISOS_INICIALES: AjustesAvisos = { recordatorios: true, seguimiento: true, bonos: true, diasInactiva: 90, cumpleanos: true };

export function leerAjustesAvisos(guardado: unknown): AjustesAvisos {
  const g = (guardado && typeof guardado === "object" ? guardado : {}) as Partial<AjustesAvisos>;
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const dias = Number.isInteger(g.diasInactiva) && g.diasInactiva! >= 0 && g.diasInactiva! <= 730 ? g.diasInactiva! : AJUSTES_AVISOS_INICIALES.diasInactiva;
  return {
    recordatorios: bool(g.recordatorios, AJUSTES_AVISOS_INICIALES.recordatorios),
    seguimiento: bool(g.seguimiento, AJUSTES_AVISOS_INICIALES.seguimiento),
    bonos: bool(g.bonos, AJUSTES_AVISOS_INICIALES.bonos),
    diasInactiva: dias,
    cumpleanos: bool(g.cumpleanos, AJUSTES_AVISOS_INICIALES.cumpleanos),
  };
}

/** ¿Es su cumpleaños ese día? (el 29 de febrero se felicita el 28 los años que no son bisiestos). */
export function esCumpleanos(fechaNacimiento: string | null, hoy: string): boolean {
  if (!fechaNacimiento) return false;
  const mmdd = fechaNacimiento.slice(5);
  const hoyMmdd = hoy.slice(5);
  if (mmdd === hoyMmdd) return true;
  const anio = Number(hoy.slice(0, 4));
  const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
  return mmdd === "02-29" && !bisiesto && hoyMmdd === "02-28";
}

/** Días entre dos fechas AAAA-MM-DD. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000);
}

/** Inactiva: vino alguna vez, hace más de `dias` de la última, y no tiene ninguna cita por delante. */
export function estaInactiva(ultimaVisita: string | null, tieneProxima: boolean, hoy: string, dias: number): boolean {
  return dias > 0 && ultimaVisita !== null && !tieneProxima && diasEntre(ultimaVisita, hoy) > dias;
}

// ── Segmentos de clientas ────────────────────────────────────────────────────

export const SEGMENTOS = ["proxima_cita", "inactivas", "cumpleanos_mes", "con_bono", "nuevas", "promociones"] as const;
export type Segmento = (typeof SEGMENTOS)[number];
export const NOMBRE_SEGMENTO: Record<Segmento, string> = {
  proxima_cita: "Con cita próxima",
  inactivas: "Hace tiempo que no vienen",
  cumpleanos_mes: "Cumplen años este mes",
  con_bono: "Con bono activo",
  nuevas: "Nuevas este mes",
  promociones: "Aceptan promociones",
};
