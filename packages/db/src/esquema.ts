/**
 * Esquema de la base de datos. Fase 0: negocio y acceso, registro de actividad, copias y catálogo.
 * Las áreas del resto de fases (agenda, ventas, facturación...) se añaden al empezar cada fase.
 *
 * Reglas generales del plan: importes en céntimos enteros, fechas con zona horaria (se muestran
 * en horario de Madrid) y borrado lógico: nada desaparece, se marca con `anuladoEn`.
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { ROLES } from "@adela/dominio";

const fecha = (nombre?: string) =>
  nombre ? timestamp(nombre, { withTimezone: true }) : timestamp({ withTimezone: true });
const creadoEn = () => fecha().notNull().defaultNow();

export const rol = pgEnum("rol", ROLES);

// ── Negocio y acceso ────────────────────────────────────────────────────────

export const centro = pgTable("centro", {
  id: uuid().primaryKey().defaultRandom(),
  nombre: text().notNull(),
  nif: text(),
  direccion: text(),
  telefono: text(),
  zonaHoraria: text().notNull().default("Europe/Madrid"),
  creadoEn: creadoEn(),
});

export const usuarios = pgTable(
  "usuarios",
  {
    id: uuid().primaryKey().defaultRandom(),
    centroId: uuid()
      .notNull()
      .references(() => centro.id),
    nombre: text().notNull(),
    usuario: text().notNull(),
    /** Solo la administración tiene contraseña: la usa para registrar equipos de confianza. */
    hashContrasena: text(),
    /** El personal entra con PIN en los equipos de confianza. */
    hashPin: text(),
    rol: rol().notNull(),
    activo: boolean().notNull().default(true),
    intentosFallidos: integer().notNull().default(0),
    bloqueadoHasta: fecha(),
    creadoEn: creadoEn(),
    actualizadoEn: creadoEn(),
  },
  (t) => [
    uniqueIndex("usuarios_usuario_unico").on(t.usuario),
    check("usuarios_admin_con_contrasena", sql`${t.rol} <> 'administrador' or ${t.hashContrasena} is not null`),
  ],
);

/** Equipos de confianza (el TPV): solo en ellos se puede entrar con PIN. */
export const dispositivos = pgTable("dispositivos", {
  id: uuid().primaryKey().defaultRandom(),
  hashToken: text().notNull().unique(),
  nombre: text().notNull(),
  registradoPor: uuid()
    .notNull()
    .references(() => usuarios.id),
  creadoEn: creadoEn(),
  ultimoUso: creadoEn(),
  revocadoEn: fecha(),
});

export const sesiones = pgTable(
  "sesiones",
  {
    id: uuid().primaryKey().defaultRandom(),
    hashToken: text().notNull().unique(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuarios.id),
    dispositivoId: uuid().references(() => dispositivos.id),
    metodo: text({ enum: ["contrasena", "pin"] }).notNull(),
    creadaEn: creadoEn(),
    ultimaActividad: creadoEn(),
    cerradaEn: fecha(),
  },
  (t) => [index("sesiones_usuario").on(t.usuarioId)],
);

/**
 * Registro de actividad: quién hizo qué, cuándo y con qué valores antes y después.
 * Solo admite INSERT: un disparador de la base de datos rechaza UPDATE y DELETE.
 */
export const registroActividad = pgTable(
  "registro_actividad",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    cuando: creadoEn(),
    usuarioId: uuid().references(() => usuarios.id),
    accion: text().notNull(),
    entidad: text(),
    entidadId: text(),
    antes: jsonb(),
    despues: jsonb(),
  },
  (t) => [index("registro_actividad_cuando").on(t.cuando)],
);

/** Resultado de cada copia de seguridad y de cada prueba de restauración. */
export const copiasSeguridad = pgTable("copias_seguridad", {
  id: bigserial({ mode: "number" }).primaryKey(),
  tipo: text({ enum: ["copia", "restauracion"] }).notNull(),
  correcta: boolean().notNull(),
  archivo: text(),
  bytes: integer(),
  detalle: text(),
  cuando: creadoEn(),
});

// ── Catálogo ────────────────────────────────────────────────────────────────

export const categorias = pgTable("categorias", {
  id: uuid().primaryKey().defaultRandom(),
  nombre: text().notNull().unique(),
  orden: integer().notNull().default(0),
  anuladoEn: fecha(),
});

export const tratamientos = pgTable(
  "tratamientos",
  {
    id: uuid().primaryKey().defaultRandom(),
    categoriaId: uuid()
      .notNull()
      .references(() => categorias.id),
    nombre: text().notNull(),
    descripcion: text(),
    /** La agenda trabaja en tramos de 5 minutos. Vacío mientras esté por decidir. */
    duracionMinutos: integer(),
    /** Vacío mientras el precio esté por decidir: se muestra «Precio a consultar» y no se puede cobrar. */
    precioCentimos: integer(),
    /**
     * Tipo de IVA en centésimas de punto (2100 = 21 %). Vacío hasta que la gestoría lo confirme:
     * no se puede facturar un tratamiento sin IVA asignado.
     */
    ivaCentesimas: integer(),
    orden: integer().notNull().default(0),
    anuladoEn: fecha(),
    creadoEn: creadoEn(),
  },
  (t) => [
    uniqueIndex("tratamientos_nombre_por_categoria").on(t.categoriaId, t.nombre),
    check("tratamientos_duracion_tramos_5", sql`${t.duracionMinutos} > 0 and ${t.duracionMinutos} % 5 = 0`),
    check("tratamientos_precio_no_negativo", sql`${t.precioCentimos} >= 0`),
    check("tratamientos_iva_valido", sql`${t.ivaCentesimas} is null or ${t.ivaCentesimas} between 0 and 10000`),
  ],
);

/** Un tipo de bono vale para un grupo de tratamientos (por ejemplo, cualquier facial). */
export const tiposBono = pgTable(
  "tipos_bono",
  {
    id: uuid().primaryKey().defaultRandom(),
    nombre: text().notNull().unique(),
    sesiones: integer().notNull(),
    precioCentimos: integer().notNull(),
    /** Días de validez desde la compra; vacío si no caduca o aún no se ha decidido. */
    validezDias: integer(),
    anuladoEn: fecha(),
    creadoEn: creadoEn(),
  },
  (t) => [
    check("tipos_bono_sesiones_positivas", sql`${t.sesiones} > 0`),
    check("tipos_bono_precio_no_negativo", sql`${t.precioCentimos} >= 0`),
  ],
);

export const tiposBonoTratamientos = pgTable(
  "tipos_bono_tratamientos",
  {
    tipoBonoId: uuid()
      .notNull()
      .references(() => tiposBono.id),
    tratamientoId: uuid()
      .notNull()
      .references(() => tratamientos.id),
  },
  (t) => [primaryKey({ columns: [t.tipoBonoId, t.tratamientoId] })],
);

// ── Reservas de clientas ────────────────────────────────────────────────────

export const franja = pgEnum("franja", ["manana", "tarde", "indiferente"]);
export const estadoSolicitud = pgEnum("estado_solicitud", ["pendiente", "confirmada", "rechazada"]);

/**
 * Peticiones de cita que hacen las clientas desde la web, sin clave. El centro las confirma o rechaza.
 * En la fase 1 se convierten en citas de la agenda, con hueco libre comprobado.
 */
export const solicitudesReserva = pgTable(
  "solicitudes_reserva",
  {
    id: uuid().primaryKey().defaultRandom(),
    tratamientoId: uuid()
      .notNull()
      .references(() => tratamientos.id),
    fechaPreferida: date({ mode: "string" }).notNull(),
    franja: franja().notNull(),
    nombre: text().notNull(),
    /** Normalizado en formato internacional: +34600111222. */
    telefono: text().notNull(),
    nota: text(),
    /** Texto de privacidad que aceptó la clienta, tal cual se le mostró. */
    consentimientoTexto: text().notNull(),
    estado: estadoSolicitud().notNull().default("pendiente"),
    gestionadaPor: uuid().references(() => usuarios.id),
    gestionadaEn: fecha(),
    creadaEn: creadoEn(),
  },
  (t) => [
    index("solicitudes_reserva_estado").on(t.estado, t.creadaEn),
    index("solicitudes_reserva_telefono").on(t.telefono),
    check("solicitudes_reserva_nombre", sql`length(trim(${t.nombre})) between 2 and 80`),
    check("solicitudes_reserva_nota", sql`${t.nota} is null or length(${t.nota}) <= 500`),
  ],
);
