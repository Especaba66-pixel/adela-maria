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
  customType,
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
  type AnyPgColumn,
  uuid,
} from "drizzle-orm/pg-core";
import { CATEGORIAS_GASTO, ROLES } from "@adela/dominio";

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
  /** Cabinas: cuántas citas puede haber a la vez en el centro. Vacío = por indicar (se cuenta 1). */
  cabinas: integer(),
  /** Datos fiscales del emisor de las facturas. Sin ellos no se puede cobrar. */
  nombreFiscal: text(),
  direccionFiscal: text(),
  pieTicket: text(),
  /** Impresora de tickets: { tipo: "ninguna" | "simulador" | "red" | "windows", host?, puerto?, nombre?, ancho? }. */
  impresora: jsonb(),
  /** Qué avisos automáticos se generan (ver AjustesAvisos en @adela/dominio). */
  avisos: jsonb(),
  /** Envío automático por WhatsApp (ver AjustesWhatsapp en @adela/dominio). */
  whatsapp: jsonb(),
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
    /** Con lo que se registra un equipo: un correo o un nombre corto, en minúsculas. */
    usuario: text().notNull(),
    /** Solo administración e invitada tienen contraseña: la usan para registrar equipos de confianza. */
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
    // Administración e invitada entran con contraseña (correo + contraseña) para registrar equipos.
    check("usuarios_admin_con_contrasena", sql`${t.rol}::text not in ('administrador', 'invitada') or ${t.hashContrasena} is not null`),
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
    /** Necesita a la profesional en exclusiva (por ejemplo, microblading): no admite otra cita a la vez. */
    exclusivo: boolean().notNull().default(false),
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
    /** IVA del bono (se factura al venderlo). Vacío hasta que lo confirme la gestoría: sin él no se vende. */
    ivaCentesimas: integer(),
    /** Días de validez desde la compra; vacío si no caduca o aún no se ha decidido. */
    validezDias: integer(),
    anuladoEn: fecha(),
    creadoEn: creadoEn(),
  },
  (t) => [
    check("tipos_bono_sesiones_positivas", sql`${t.sesiones} > 0`),
    check("tipos_bono_precio_no_negativo", sql`${t.precioCentimos} >= 0`),
    check("tipos_bono_iva_valido", sql`${t.ivaCentesimas} is null or ${t.ivaCentesimas} between 0 and 10000`),
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

// ── Fase 1: personas, equipo y agenda ───────────────────────────────────────

/** Clientas y clientes del centro. «Clientas» es solo la etiqueta del menú. */
export const clientes = pgTable(
  "clientes",
  {
    id: uuid().primaryKey().defaultRandom(),
    nombre: text().notNull(),
    /** Normalizado: +34600111222. */
    telefono: text(),
    email: text(),
    fechaNacimiento: date({ mode: "string" }),
    notas: text(),
    /** Permisos separados para WhatsApp: avisos de sus citas y promociones. */
    aceptaAvisosCitas: boolean().notNull().default(false),
    aceptaPromociones: boolean().notNull().default(false),
    creadaEn: creadoEn(),
    /** Supresión de datos a petición (RGPD): se anonimiza la ficha, no se borra. */
    anonimizadaEn: fecha(),
  },
  (t) => [
    uniqueIndex("clientes_telefono_unico").on(t.telefono).where(sql`${t.anonimizadaEn} is null and ${t.telefono} is not null`),
    index("clientes_nombre").on(t.nombre),
    check("clientes_nombre_valido", sql`length(trim(${t.nombre})) between 2 and 80`),
  ],
);

/** Cada permiso que da (o retira) una clienta, con el texto exacto y por dónde. */
export const consentimientos = pgTable("consentimientos", {
  id: uuid().primaryKey().defaultRandom(),
  clienteId: uuid()
    .notNull()
    .references(() => clientes.id),
  tipo: text({ enum: ["privacidad_reserva", "avisos_citas", "promociones"] }).notNull(),
  aceptado: boolean().notNull(),
  texto: text(),
  canal: text({ enum: ["web", "centro", "whatsapp"] }).notNull(),
  registradoPor: uuid().references(() => usuarios.id),
  cuando: creadoEn(),
});

/** Notas de la línea temporal de la ficha. */
export const notasClientes = pgTable("notas_clientes", {
  id: uuid().primaryKey().defaultRandom(),
  clienteId: uuid()
    .notNull()
    .references(() => clientes.id),
  texto: text().notNull(),
  autorId: uuid()
    .notNull()
    .references(() => usuarios.id),
  creadaEn: creadoEn(),
});

/** Quien atiende citas. Puede tener usuario (para ver su propia agenda) o no. */
export const profesionales = pgTable("profesionales", {
  id: uuid().primaryKey().defaultRandom(),
  nombre: text().notNull().unique(),
  usuarioId: uuid()
    .unique()
    .references(() => usuarios.id),
  color: text().notNull().default("#b08d57"),
  activo: boolean().notNull().default(true),
  orden: integer().notNull().default(0),
  /** Comisión sobre lo que vende (base sin IVA), en centésimas de punto: 1000 = 10 %. */
  comisionServicios: integer().notNull().default(0),
  comisionProductos: integer().notNull().default(0),
});

/** Qué tratamientos hace cada profesional. Si no tiene ninguno apuntado, los hace todos. */
export const profesionalesTratamientos = pgTable(
  "profesionales_tratamientos",
  {
    profesionalId: uuid()
      .notNull()
      .references(() => profesionales.id),
    tratamientoId: uuid()
      .notNull()
      .references(() => tratamientos.id),
  },
  (t) => [primaryKey({ columns: [t.profesionalId, t.tratamientoId] })],
);

/** Horario semanal: uno o varios tramos por día (por ejemplo, mañana y tarde). */
export const horarios = pgTable(
  "horarios",
  {
    id: uuid().primaryKey().defaultRandom(),
    profesionalId: uuid()
      .notNull()
      .references(() => profesionales.id),
    /** 1 = lunes … 7 = domingo. */
    diaSemana: integer().notNull(),
    /** Minutos desde medianoche. */
    inicioMin: integer().notNull(),
    finMin: integer().notNull(),
  },
  (t) => [
    index("horarios_profesional").on(t.profesionalId, t.diaSemana),
    check("horarios_dia_valido", sql`${t.diaSemana} between 1 and 7`),
    check(
      "horarios_tramo_valido",
      sql`${t.inicioMin} >= 0 and ${t.finMin} <= 1440 and ${t.inicioMin} < ${t.finMin} and ${t.inicioMin} % 5 = 0 and ${t.finMin} % 5 = 0`,
    ),
  ],
);

/** Vacaciones, descansos y horarios especiales. Sin profesional = todo el centro. */
export const bloqueos = pgTable(
  "bloqueos",
  {
    id: uuid().primaryKey().defaultRandom(),
    profesionalId: uuid().references(() => profesionales.id),
    inicio: fecha().notNull(),
    fin: fecha().notNull(),
    tipo: text({ enum: ["vacaciones", "descanso", "otro"] }).notNull(),
    motivo: text(),
    creadoPor: uuid()
      .notNull()
      .references(() => usuarios.id),
    creadoEn: creadoEn(),
    anuladoEn: fecha(),
  },
  (t) => [check("bloqueos_intervalo", sql`${t.inicio} < ${t.fin}`), index("bloqueos_inicio").on(t.inicio)],
);

/** Citas que se repiten (cada N semanas, M veces). */
export const series = pgTable("series", {
  id: uuid().primaryKey().defaultRandom(),
  cadaSemanas: integer().notNull(),
  veces: integer().notNull(),
  creadaPor: uuid()
    .notNull()
    .references(() => usuarios.id),
  creadaEn: creadoEn(),
});

export const estadoCita = pgEnum("estado_cita", ["pendiente", "confirmada", "realizada", "no_presentada", "cancelada"]);

/**
 * Citas. Pueden coincidir varias a la vez, una por cabina, salvo las exclusivas (microblading), que van solas.
 * Lo comprueba la base de datos con el disparador `citas_comprobar_hueco` (en la migración).
 */
export const citas = pgTable(
  "citas",
  {
    id: uuid().primaryKey().defaultRandom(),
    clienteId: uuid()
      .notNull()
      .references(() => clientes.id),
    profesionalId: uuid()
      .notNull()
      .references(() => profesionales.id),
    inicio: fecha().notNull(),
    fin: fecha().notNull(),
    estado: estadoCita().notNull().default("confirmada"),
    /** Alguno de sus servicios necesita a la profesional en exclusiva. */
    exclusiva: boolean().notNull().default(false),
    origen: text({ enum: ["centro", "web"] }).notNull(),
    serieId: uuid().references(() => series.id),
    solicitudId: uuid().references(() => solicitudesReserva.id),
    nota: text(),
    /** La clienta confirmó que viene (respondiendo al recordatorio de WhatsApp). */
    confirmadaPorClientaEn: timestamp({ withTimezone: true }),
    creadaPor: uuid().references(() => usuarios.id),
    creadaEn: creadoEn(),
    actualizadaEn: creadoEn(),
  },
  (t) => [
    index("citas_inicio").on(t.inicio),
    index("citas_cliente").on(t.clienteId, t.inicio),
    check("citas_intervalo", sql`${t.inicio} < ${t.fin}`),
  ],
);

/** Servicios de una cita, con la duración y el precio de ese momento. */
export const citasServicios = pgTable(
  "citas_servicios",
  {
    citaId: uuid()
      .notNull()
      .references(() => citas.id),
    orden: integer().notNull(),
    tratamientoId: uuid()
      .notNull()
      .references(() => tratamientos.id),
    duracionMinutos: integer().notNull(),
    precioCentimos: integer(),
  },
  (t) => [primaryKey({ columns: [t.citaId, t.orden] })],
);

// ── Fase 2: cobros, caja y facturación ──────────────────────────────────────

export const metodoPago = pgEnum("metodo_pago", ["efectivo", "tarjeta", "bizum", "tarjeta_regalo"]);

/** Una sesión de caja por jornada: se abre con un fondo y se cierra contando el efectivo. Solo una abierta a la vez. */
export const sesionesCaja = pgTable("sesiones_caja", {
  id: uuid().primaryKey().defaultRandom(),
  abiertaEn: creadoEn(),
  abiertaPor: uuid()
    .notNull()
    .references(() => usuarios.id),
  fondoInicial: integer().notNull(),
  cerradaEn: fecha(),
  cerradaPor: uuid().references(() => usuarios.id),
  efectivoEsperado: integer(),
  efectivoContado: integer(),
  notasCierre: text(),
});

/** Ventas: lo que se cobra en el TPV. Las devoluciones son otra venta en negativo enlazada a la original. */
export const ventas = pgTable(
  "ventas",
  {
    id: uuid().primaryKey().defaultRandom(),
    clienteId: uuid().references(() => clientes.id),
    citaId: uuid().references(() => citas.id),
    devolucionDe: uuid(),
    /** Quién atendió (para los informes por profesional y las comisiones). */
    profesionalId: uuid().references(() => profesionales.id),
    total: integer().notNull(),
    /** La venta de una tarjeta regalo no lleva factura: se factura lo que se paga con ella al usarla. */
    conFactura: boolean().notNull().default(true),
    creadaPor: uuid()
      .notNull()
      .references(() => usuarios.id),
    creadaEn: creadoEn(),
  },
  (t) => [
    uniqueIndex("ventas_una_por_cita").on(t.citaId),
    uniqueIndex("ventas_una_devolucion").on(t.devolucionDe),
    index("ventas_creada").on(t.creadaEn),
  ],
);

export const lineasVenta = pgTable(
  "lineas_venta",
  {
    ventaId: uuid()
      .notNull()
      .references(() => ventas.id),
    orden: integer().notNull(),
    tratamientoId: uuid().references(() => tratamientos.id),
    tipoBonoId: uuid().references(() => tiposBono.id),
    productoId: uuid().references((): AnyPgColumn => productos.id),
    descripcion: text().notNull(),
    cantidad: integer().notNull(),
    precioUnitario: integer().notNull(),
    descuentoCentesimas: integer().notNull().default(0),
    ivaCentesimas: integer().notNull(),
    total: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.ventaId, t.orden] })],
);

/** Pagos de una venta (varios = pago mixto). Las devoluciones van en negativo. */
export const pagos = pgTable("pagos", {
  id: uuid().primaryKey().defaultRandom(),
  ventaId: uuid()
    .notNull()
    .references(() => ventas.id),
  metodo: metodoPago().notNull(),
  importe: integer().notNull(),
  /** Tarjeta regalo con la que se paga (solo si el método es tarjeta regalo). */
  tarjetaRegaloId: uuid().references((): AnyPgColumn => tarjetasRegalo.id),
  /** Efectivo entregado por la clienta (para calcular el cambio). */
  entregado: integer(),
  sesionCajaId: uuid()
    .notNull()
    .references(() => sesionesCaja.id),
  usuarioId: uuid()
    .notNull()
    .references(() => usuarios.id),
  cuando: creadoEn(),
});

/** Movimientos de efectivo del cajón: fondo, ventas y devoluciones en efectivo, entradas y salidas. */
export const movimientosCaja = pgTable(
  "movimientos_caja",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    sesionCajaId: uuid()
      .notNull()
      .references(() => sesionesCaja.id),
    tipo: text({ enum: ["fondo", "venta", "devolucion", "entrada", "salida"] }).notNull(),
    importe: integer().notNull(),
    concepto: text(),
    pagoId: uuid().references(() => pagos.id),
    usuarioId: uuid()
      .notNull()
      .references(() => usuarios.id),
    cuando: creadoEn(),
  },
  (t) => [index("movimientos_caja_sesion").on(t.sesionCajaId)],
);

/** Contador de cada serie de facturas (una por tipo y año), para numerar sin saltos. */
export const seriesFacturacion = pgTable("series_facturacion", {
  codigo: text().primaryKey(),
  tipo: text({ enum: ["simplificada", "completa", "rectificativa"] }).notNull(),
  anio: integer().notNull(),
  ultimoNumero: integer().notNull().default(0),
});

/** Facturas emitidas. No se modifican ni se borran nunca: un error se corrige con una rectificativa. */
export const facturas = pgTable(
  "facturas",
  {
    id: uuid().primaryKey().defaultRandom(),
    serie: text()
      .notNull()
      .references(() => seriesFacturacion.codigo),
    numero: integer().notNull(),
    numeroCompleto: text().notNull().unique(),
    tipo: text({ enum: ["simplificada", "completa", "rectificativa"] }).notNull(),
    fechaExpedicion: date({ mode: "string" }).notNull(),
    expedidaEn: creadoEn(),
    ventaId: uuid()
      .notNull()
      .references(() => ventas.id),
    rectificaA: uuid(),
    /** Copia de los datos del emisor en ese momento. */
    emisor: jsonb().notNull(),
    /** Datos de la clienta (solo facturas completas). */
    destinatario: jsonb(),
    desglose: jsonb().notNull(),
    baseTotal: integer().notNull(),
    cuotaTotal: integer().notNull(),
    total: integer().notNull(),
  },
  (t) => [uniqueIndex("facturas_serie_numero").on(t.serie, t.numero), index("facturas_venta").on(t.ventaId)],
);

/** Registro de facturación: cada alta genera un registro con huella encadenada al anterior. */
export const registrosFacturacion = pgTable("registros_facturacion", {
  id: bigserial({ mode: "number" }).primaryKey(),
  facturaId: uuid()
    .notNull()
    .references(() => facturas.id),
  tipo: text({ enum: ["alta", "anulacion"] }).notNull(),
  huella: text().notNull().unique(),
  huellaAnterior: text(),
  datos: jsonb().notNull(),
  creadoEn: creadoEn(),
});

// ── Fase 3: bonos y tarjetas regalo ─────────────────────────────────────────

/** Bonos vendidos: uno por unidad vendida, con los datos del tipo de bono en ese momento. */
export const bonos = pgTable(
  "bonos",
  {
    id: uuid().primaryKey().defaultRandom(),
    tipoBonoId: uuid()
      .notNull()
      .references(() => tiposBono.id),
    clienteId: uuid()
      .notNull()
      .references(() => clientes.id),
    ventaId: uuid()
      .notNull()
      .references(() => ventas.id),
    nombre: text().notNull(),
    sesiones: integer().notNull(),
    compradoEn: creadoEn(),
    /** Último día en que vale, incluido. Vacío: no caduca. */
    caducaEn: date({ mode: "string" }),
    /** Se anula al devolver la venta (solo si no se ha usado). */
    anuladoEn: fecha(),
  },
  (t) => [index("bonos_cliente").on(t.clienteId), index("bonos_venta").on(t.ventaId), check("bonos_sesiones_positivas", sql`${t.sesiones} > 0`)],
);

/** Tratamientos para los que vale cada bono vendido (copia del tipo de bono al venderlo). */
export const bonosTratamientos = pgTable(
  "bonos_tratamientos",
  {
    bonoId: uuid()
      .notNull()
      .references(() => bonos.id),
    tratamientoId: uuid()
      .notNull()
      .references(() => tratamientos.id),
  },
  (t) => [primaryKey({ columns: [t.bonoId, t.tratamientoId] })],
);

/**
 * Sesiones gastadas de cada bono. Solo se añaden filas: una sesión gastada es +1 y una corrección (sesión
 * devuelta) es −1, con su motivo. La base de datos impide gastar más sesiones de las que tiene el bono.
 */
export const usosBono = pgTable(
  "usos_bono",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    bonoId: uuid()
      .notNull()
      .references(() => bonos.id),
    cantidad: integer().notNull(),
    tratamientoId: uuid().references(() => tratamientos.id),
    citaId: uuid().references(() => citas.id),
    ventaId: uuid().references(() => ventas.id),
    motivo: text(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuarios.id),
    cuando: creadoEn(),
  },
  (t) => [
    index("usos_bono_bono").on(t.bonoId),
    index("usos_bono_cita").on(t.citaId),
    check("usos_bono_cantidad", sql`${t.cantidad} in (1, -1)`),
    check("usos_bono_correccion_con_motivo", sql`${t.cantidad} = 1 or ${t.motivo} is not null`),
  ],
);

/** Tarjetas regalo: un saldo en euros con un código para canjearlo. */
export const tarjetasRegalo = pgTable(
  "tarjetas_regalo",
  {
    id: uuid().primaryKey().defaultRandom(),
    codigo: text().notNull().unique(),
    importeInicial: integer().notNull(),
    /** Quien la recibe y quien la regala (para el vale). */
    para: text(),
    deParte: text(),
    /** Clienta que la compra, si se sabe. */
    clienteId: uuid().references(() => clientes.id),
    ventaId: uuid()
      .notNull()
      .references(() => ventas.id),
    creadaEn: creadoEn(),
    /** Se anula al devolverla sin haberla usado. */
    anuladaEn: fecha(),
  },
  (t) => [uniqueIndex("tarjetas_regalo_venta").on(t.ventaId), check("tarjetas_regalo_importe_positivo", sql`${t.importeInicial} > 0`)],
);

/** Movimientos del saldo de cada tarjeta: la carga inicial (+), los pagos (−) y lo que vuelve si se devuelve una venta (+). */
export const movimientosTarjetaRegalo = pgTable(
  "movimientos_tarjeta_regalo",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    tarjetaId: uuid()
      .notNull()
      .references(() => tarjetasRegalo.id),
    tipo: text({ enum: ["carga", "pago", "devolucion", "anulacion"] }).notNull(),
    importe: integer().notNull(),
    pagoId: uuid().references(() => pagos.id),
    usuarioId: uuid()
      .notNull()
      .references(() => usuarios.id),
    cuando: creadoEn(),
  },
  (t) => [index("movimientos_tarjeta_regalo_tarjeta").on(t.tarjetaId), check("movimientos_tarjeta_regalo_no_cero", sql`${t.importe} <> 0`)],
);

// ── Reservas por internet ───────────────────────────────────────────────────

/** Reservas hechas en la web de internet (Cloudflare) que ya se han pasado a la agenda: no se importan dos veces. */
export const reservasOnline = pgTable("reservas_online", {
  id: text().primaryKey(),
  citaId: uuid().references(() => citas.id),
  solicitudId: uuid().references(() => solicitudesReserva.id),
  importadaEn: creadoEn(),
});

// ── Fase 4: stock, proveedores y gastos ─────────────────────────────────────

export const proveedores = pgTable("proveedores", {
  id: uuid().primaryKey().defaultRandom(),
  nombre: text().notNull().unique(),
  nif: text(),
  telefono: text(),
  email: text(),
  notas: text(),
  anuladoEn: fecha(),
  creadoEn: creadoEn(),
});

/** Productos: los que se venden en el TPV y los que se gastan en cabina. Su stock es la suma de sus movimientos. */
export const productos = pgTable(
  "productos",
  {
    id: uuid().primaryKey().defaultRandom(),
    nombre: text().notNull().unique(),
    /** «venta»: se vende a las clientas; «cabina»: se gasta en los tratamientos. */
    uso: text({ enum: ["venta", "cabina"] }).notNull(),
    referencia: text(),
    /** Precio de venta con IVA (solo productos de venta). */
    precioCentimos: integer(),
    ivaCentesimas: integer(),
    /** Último coste de compra por unidad, sin IVA. */
    costeCentimos: integer(),
    /** Por debajo de esto, aviso de stock bajo. */
    stockMinimo: integer().notNull().default(0),
    proveedorId: uuid().references(() => proveedores.id),
    anuladoEn: fecha(),
    creadoEn: creadoEn(),
  },
  (t) => [
    check("productos_precio_no_negativo", sql`${t.precioCentimos} is null or ${t.precioCentimos} >= 0`),
    check("productos_iva_valido", sql`${t.ivaCentesimas} is null or ${t.ivaCentesimas} between 0 and 10000`),
    check("productos_minimo_no_negativo", sql`${t.stockMinimo} >= 0`),
  ],
);

/** Lo que se gasta de un producto de cabina en cada tratamiento (se descuenta solo al cobrarlo o usar el bono). */
export const consumosTratamiento = pgTable(
  "consumos_tratamiento",
  {
    tratamientoId: uuid()
      .notNull()
      .references(() => tratamientos.id),
    productoId: uuid()
      .notNull()
      .references(() => productos.id),
    cantidad: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.tratamientoId, t.productoId] }), check("consumos_cantidad_positiva", sql`${t.cantidad} > 0`)],
);

/** Compras a proveedores: entran en el stock y generan su gasto. */
export const compras = pgTable("compras", {
  id: uuid().primaryKey().defaultRandom(),
  proveedorId: uuid()
    .notNull()
    .references(() => proveedores.id),
  fecha: date({ mode: "string" }).notNull(),
  numeroFactura: text(),
  /** Descuento sobre el pedido, sin IVA (las líneas guardan el precio tal como viene en la factura). */
  descuento: integer().notNull().default(0),
  notas: text(),
  usuarioId: uuid()
    .notNull()
    .references(() => usuarios.id),
  creadaEn: creadoEn(),
}, (t) => [check("compras_descuento_no_negativo", sql`${t.descuento} >= 0`)]);

export const lineasCompra = pgTable(
  "lineas_compra",
  {
    compraId: uuid()
      .notNull()
      .references(() => compras.id),
    orden: integer().notNull(),
    productoId: uuid()
      .notNull()
      .references(() => productos.id),
    cantidad: integer().notNull(),
    /** Coste por unidad, sin IVA. */
    costeUnitario: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.compraId, t.orden] }), check("lineas_compra_cantidad", sql`${t.cantidad} > 0`), check("lineas_compra_coste", sql`${t.costeUnitario} >= 0`)],
);

/** Movimientos de stock. Solo se añaden: un error se corrige con otro movimiento (ajuste). */
export const movimientosStock = pgTable(
  "movimientos_stock",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    productoId: uuid()
      .notNull()
      .references(() => productos.id),
    tipo: text({ enum: ["compra", "venta", "devolucion", "consumo", "ajuste", "merma"] }).notNull(),
    cantidad: integer().notNull(),
    compraId: uuid().references(() => compras.id),
    ventaId: uuid().references(() => ventas.id),
    citaId: uuid().references(() => citas.id),
    motivo: text(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuarios.id),
    cuando: creadoEn(),
  },
  (t) => [index("movimientos_stock_producto").on(t.productoId), check("movimientos_stock_no_cero", sql`${t.cantidad} <> 0`)],
);

/** Gastos del centro (facturas recibidas), para el resumen de IVA y la gestoría. */
export const gastos = pgTable(
  "gastos",
  {
    id: uuid().primaryKey().defaultRandom(),
    fecha: date({ mode: "string" }).notNull(),
    categoria: text({ enum: CATEGORIAS_GASTO }).notNull(),
    concepto: text().notNull(),
    proveedorId: uuid().references(() => proveedores.id),
    numeroFactura: text(),
    /** Base imponible, tipo y cuota de IVA soportado, y total pagado. */
    base: integer().notNull(),
    ivaCentesimas: integer().notNull(),
    cuota: integer().notNull(),
    total: integer().notNull(),
    compraId: uuid().references(() => compras.id),
    /** Si se pagó en efectivo con dinero de la caja. */
    pagoCaja: boolean().notNull().default(false),
    usuarioId: uuid()
      .notNull()
      .references(() => usuarios.id),
    creadoEn: creadoEn(),
    anuladoEn: fecha(),
  },
  (t) => [
    index("gastos_fecha").on(t.fecha),
    uniqueIndex("gastos_una_por_compra").on(t.compraId),
    check("gastos_cuadra", sql`${t.base} + ${t.cuota} = ${t.total}`),
    check("gastos_iva_valido", sql`${t.ivaCentesimas} between 0 and 10000`),
  ],
);

// ── Fase 5: avisos, tareas y seguimiento ────────────────────────────────────

/** Tareas que apunta el personal («llamar a Marta para cambiar la cita»), con fecha opcional. */
export const tareas = pgTable(
  "tareas",
  {
    id: uuid().primaryKey().defaultRandom(),
    texto: text().notNull(),
    /** Día en que hay que hacerla; vacía = cuando se pueda. */
    fecha: date({ mode: "string" }),
    clienteId: uuid().references(() => clientes.id),
    creadaPor: uuid()
      .notNull()
      .references(() => usuarios.id),
    creadaEn: creadoEn(),
    hechaPor: uuid().references(() => usuarios.id),
    hechaEn: fecha(),
  },
  (t) => [index("tareas_pendientes").on(t.hechaEn, t.fecha), check("tareas_texto", sql`length(trim(${t.texto})) between 2 and 300`)],
);

/**
 * Avisos automáticos ya atendidos o pospuestos. Cada aviso tiene una clave estable (por ejemplo
 * «recordatorio:<id de la cita>»): al marcarlo hecho deja de salir; al posponerlo, vuelve ese día.
 */
export const avisosAtendidos = pgTable("avisos_atendidos", {
  clave: text().primaryKey(),
  /** Hasta cuándo no se enseña (incluido). Vacía = hecho para siempre. */
  posponerHasta: date({ mode: "string" }),
  /** Vacío si lo resolvió la app sola (por ejemplo, una clienta que confirma por WhatsApp). */
  usuarioId: uuid().references(() => usuarios.id),
  cuando: creadoEn(),
});

/** Plantillas de mensajes de WhatsApp, editables. */
export const plantillas = pgTable("plantillas", {
  clave: text().primaryKey(),
  nombre: text().notNull(),
  permiso: text({ enum: ["cita", "promocion"] }).notNull(),
  texto: text().notNull(),
  /** Plantilla aprobada en Meta para enviarla sola (vacío = solo con el botón que abre WhatsApp). */
  metaNombre: text(),
  metaIdioma: text().notNull().default("es"),
  metaCategoria: text({ enum: ["utility", "marketing"] }),
  /** Qué variable va en {{1}}, {{2}}… */
  metaVariables: jsonb().$type<string[]>().notNull().default([]),
  /** Lleva los botones Confirmar / Cambiar. */
  metaBotones: boolean().notNull().default(false),
  actualizadaEn: creadoEn(),
});

/** Envíos a un grupo de clientas (solo a las que aceptan promociones). */
export const campanas = pgTable("campanas", {
  id: uuid().primaryKey().defaultRandom(),
  segmento: text().notNull(),
  plantilla: text()
    .notNull()
    .references(() => plantillas.clave),
  total: integer().notNull(),
  usuarioId: uuid()
    .notNull()
    .references(() => usuarios.id),
  cuando: creadoEn(),
});

/**
 * Mensajes de WhatsApp de cada clienta: los preparados con el botón (se abren en WhatsApp), los enviados por la API
 * y las respuestas que llegan. Solo cambian el estado del envío; lo demás no se toca.
 */
export const mensajes = pgTable(
  "mensajes",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Vacía si escribe un número que no está en ninguna ficha. */
    clienteId: uuid().references(() => clientes.id),
    telefono: text(),
    direccion: text({ enum: ["saliente", "entrante"] }).notNull().default("saliente"),
    plantilla: text(),
    texto: text().notNull(),
    canal: text({ enum: ["whatsapp_enlace", "whatsapp_api"] }).notNull(),
    /** Quién lo preparó o envió; vacío si lo envió la app sola o es una respuesta. */
    usuarioId: uuid().references(() => usuarios.id),
    citaId: uuid().references(() => citas.id),
    campanaId: uuid().references(() => campanas.id),
    /** Identificador de Meta (wamid). */
    waId: text(),
    estado: text({ enum: ["enviando", "enviado", "entregado", "leido", "fallido"] }),
    estadoEn: timestamp({ withTimezone: true }),
    error: text(),
    /** Botón pulsado en la respuesta (CONFIRMAR, CAMBIAR…). */
    boton: text(),
    /** wamid del mensaje nuestro al que responde. */
    responde: text(),
    cuando: creadoEn(),
  },
  (t) => [
    index("mensajes_cliente").on(t.clienteId, t.cuando),
    uniqueIndex("mensajes_wa_id").on(t.waId),
    index("mensajes_entrantes").on(t.direccion, t.cuando),
    // Un mismo aviso de una cita se envía una sola vez por la API (si falla, se puede volver a intentar).
    uniqueIndex("mensajes_api_cita_unico")
      .on(t.citaId, t.plantilla)
      .where(sql`${t.canal} = 'whatsapp_api' and ${t.citaId} is not null and ${t.estado} <> 'fallido'`),
  ],
);

// ── Fase 7: fotos y consentimientos informados ──────────────────────────────

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/** Fotos de la ficha (antes y después). Se guardan reducidas dentro de la base de datos: así entran en las copias. */
export const fotosClientes = pgTable(
  "fotos_clientes",
  {
    id: uuid().primaryKey().defaultRandom(),
    clienteId: uuid()
      .notNull()
      .references(() => clientes.id),
    tipo: text({ enum: ["antes", "despues", "otra"] }).notNull(),
    nota: text(),
    citaId: uuid().references(() => citas.id),
    mime: text({ enum: ["image/jpeg", "image/png", "image/webp"] }).notNull(),
    datos: bytea().notNull(),
    subidaPor: uuid()
      .notNull()
      .references(() => usuarios.id),
    subidaEn: creadoEn(),
  },
  (t) => [index("fotos_cliente").on(t.clienteId, t.subidaEn), check("fotos_tamano", sql`octet_length(${t.datos}) <= 3145728`)],
);

/** Modelos de consentimiento informado (texto que firma la clienta), y para qué tratamientos hacen falta. */
export const modelosConsentimiento = pgTable("modelos_consentimiento", {
  id: uuid().primaryKey().defaultRandom(),
  nombre: text().notNull().unique(),
  texto: text().notNull(),
  activo: boolean().notNull().default(true),
  actualizadoEn: creadoEn(),
});

export const modelosConsentimientoTratamientos = pgTable(
  "modelos_consentimiento_tratamientos",
  {
    modeloId: uuid()
      .notNull()
      .references(() => modelosConsentimiento.id),
    tratamientoId: uuid()
      .notNull()
      .references(() => tratamientos.id),
  },
  (t) => [primaryKey({ columns: [t.modeloId, t.tratamientoId] })],
);

/** Consentimientos firmados en el TPV: copia del texto firmado y la firma. Solo se pueden revocar. */
export const consentimientosFirmados = pgTable(
  "consentimientos_firmados",
  {
    id: uuid().primaryKey().defaultRandom(),
    clienteId: uuid()
      .notNull()
      .references(() => clientes.id),
    modeloId: uuid()
      .notNull()
      .references(() => modelosConsentimiento.id),
    nombreModelo: text().notNull(),
    texto: text().notNull(),
    /** Firma dibujada con el dedo (imagen PNG en formato data:). */
    firma: text().notNull(),
    firmante: text().notNull(),
    citaId: uuid().references(() => citas.id),
    registradoPor: uuid()
      .notNull()
      .references(() => usuarios.id),
    firmadoEn: creadoEn(),
    revocadoEn: fecha(),
    revocadoPor: uuid().references(() => usuarios.id),
  },
  (t) => [index("consentimientos_firmados_cliente").on(t.clienteId, t.firmadoEn), check("firma_tamano", sql`length(${t.firma}) <= 400000`)],
);
