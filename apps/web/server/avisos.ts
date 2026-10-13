import "server-only";
import { avisosAtendidos, centro, citas, clientes, cobros, mensajes, plantillas, solicitudesReserva, tareas, tratamientos, type Tx } from "@adela/db";
import {
  esCumpleanos,
  estaInactiva,
  formatearEuros,
  horaATexto,
  hoyEnMadrid,
  dentroDeFranja,
  entenderRespuesta,
  formatearTelefono,
  leerAjustesAvisos,
  ordenarPorPrioridad,
  partesMadrid,
  puede,
  sumarDias,
  textoQuedan,
  type PrioridadAviso,
  type Rol,
} from "@adela/dominio";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { diaLargo } from "@/lib/fechas";
import { citasDelDia } from "./agenda";
import { bonosPorAcabar } from "./bonos";
import { db } from "./db";
import { avisosSistema } from "./estado";
import { contarStockBajo, productosConStock } from "./stock";
import { ventasPendientes } from "./tpv";
import { plantillaMeta } from "./mensajes";
import { consentimientosQueFaltan } from "./fichas";
import { ajustesWhatsapp, apiWhatsapp } from "./whatsapp";

/** Un mensaje de WhatsApp listo para preparar desde un aviso. */
export interface MensajeAviso {
  clienteId: string;
  plantilla: string;
  citaId?: string;
  bonoId?: string;
  /** Si no se puede escribir (sin teléfono o sin permiso), por qué. */
  noDisponible?: string;
  /** Se puede enviar desde la app (API de WhatsApp y plantilla aprobada en Meta). */
  api?: boolean;
}

export interface AvisoDia {
  /** Clave estable para marcarlo hecho o posponerlo (sin clave, se resuelve solo al hacer la tarea). */
  clave?: string;
  prioridad: PrioridadAviso;
  titulo: string;
  detalle?: string;
  enlace?: string;
  mensaje?: MensajeAviso;
  /** Tarea apuntada a mano (se marca hecha en su tabla). */
  tareaId?: string;
}

const primerNombre = (n: string) => n.trim().split(/\s+/)[0] ?? n;

export async function ajustesAvisos() {
  const [c] = await db().select({ avisos: centro.avisos }).from(centro).limit(1);
  return leerAjustesAvisos(c?.avisos);
}

/** Permiso para escribir a una clienta con esa plantilla (las confirmaciones de lo que ella pidió, siempre). */
function disponible(c: { telefono: string | null; aceptaAvisosCitas: boolean; aceptaPromociones: boolean }, permiso: "cita" | "promocion" | "pedido"): string | undefined {
  if (!c.telefono) return "Sin teléfono";
  if (permiso === "cita" && !c.aceptaAvisosCitas) return "No ha dado permiso para avisos de citas";
  if (permiso === "promocion" && !c.aceptaPromociones) return "No ha dado permiso para promociones";
  return undefined;
}

/** Todo lo que hay que hacer hoy, según los permisos de quien mira, ordenado por urgencia. */
export async function avisosDeHoy(usuario: { rol: Rol }): Promise<AvisoDia[]> {
  const ahora = new Date();
  const hoy = hoyEnMadrid(ahora);
  const ajustes = await ajustesAvisos();
  const lista: AvisoDia[] = [];
  const ver = (p: Parameters<typeof puede>[1]) => puede(usuario.rol, p);

  if (ver("configuracion.gestionar")) {
    for (const a of await avisosSistema()) {
      lista.push({ prioridad: a.prioridad === "correcto" ? "informativo" : a.prioridad, titulo: a.texto, enlace: a.enlace });
    }
  }

  if (ver("cobrar")) {
    const caja = await cobros.cajaAbierta(db());
    if (caja && partesMadrid(caja.abiertaEn).fecha < hoy) {
      lista.push({ prioridad: "urgente", titulo: "La caja de un día anterior sigue abierta: ciérrala contando el efectivo.", enlace: "/gestion/caja" });
    }
    for (const v of await ventasPendientes()) {
      lista.push({ prioridad: "importante", titulo: `${v.cliente ?? "Una venta sin clienta"} debe ${formatearEuros(v.pendiente)}.`, enlace: `/gestion/tpv/pendiente/${v.id}` });
    }
  }

  if (ver("reservas.gestionar")) {
    const porConfirmar = await db()
      .select({ id: citas.id, inicio: citas.inicio, clienteId: clientes.id, nombre: clientes.nombre, telefono: clientes.telefono, avisos: clientes.aceptaAvisosCitas, promos: clientes.aceptaPromociones })
      .from(citas)
      .innerJoin(clientes, eq(clientes.id, citas.clienteId))
      .where(and(eq(citas.estado, "pendiente"), gte(citas.fin, ahora)))
      .orderBy(asc(citas.inicio));
    for (const c of porConfirmar) {
      const p = partesMadrid(c.inicio);
      const pronto = c.inicio.getTime() - ahora.getTime() < 24 * 3_600_000;
      lista.push({
        prioridad: pronto ? "urgente" : "importante",
        titulo: `Confirmar la cita de ${c.nombre}: ${diaLargo(p.fecha)}, ${horaATexto(p.minutos)}.`,
        detalle: "Reservada por la clienta. Confírmala o recházala en Reservas.",
        enlace: "/gestion/reservas",
        mensaje: { clienteId: c.clienteId, plantilla: "confirmar_cita", citaId: c.id, noDisponible: disponible({ telefono: c.telefono, aceptaAvisosCitas: c.avisos, aceptaPromociones: c.promos }, "pedido") },
      });
    }
    const sinHora = await db()
      .select({ s: solicitudesReserva, tratamiento: tratamientos.nombre })
      .from(solicitudesReserva)
      .innerJoin(tratamientos, eq(tratamientos.id, solicitudesReserva.tratamientoId))
      .where(eq(solicitudesReserva.estado, "pendiente"))
      .orderBy(asc(solicitudesReserva.creadaEn));
    for (const { s, tratamiento } of sinHora) {
      lista.push({ prioridad: "importante", titulo: `Dar cita a ${s.nombre} (${tratamiento}).`, detalle: "Pidió cita sin hora concreta.", enlace: "/gestion/reservas" });
    }
  }

  if (ver("stock.gestionar") && (await contarStockBajo()) > 0) {
    const bajos = (await productosConStock()).filter((p) => p.bajo);
    lista.push({ prioridad: "importante", titulo: `Hay que reponer: ${bajos.map((p) => `${p.nombre} (quedan ${p.stock})`).join(", ")}.`, enlace: "/gestion/mas/stock" });
  }

  if (ver("agenda.ver_toda") && ver("clientas.gestionar")) {
    const fichas = async (ids: string[]) => (ids.length ? await db().select().from(clientes).where(inArray(clientes.id, ids)) : []);

    // Con WhatsApp automático, los recordatorios y el «qué tal» salen solos: aquí solo aparecen si fallan o si ya
    // pasó la hora de envío sin que se enviaran (TPV apagado).
    const aprobadas = apiWhatsapp() ? new Set((await db().select().from(plantillas)).filter((p) => plantillaMeta(p)).map((p) => p.clave)) : new Set<string>();
    const wa = aprobadas.size ? await ajustesWhatsapp() : null;
    const autoActivo = (plantilla: string, activo: boolean | undefined) => Boolean(wa && activo && aprobadas.has(plantilla));
    const yaPasoLaHora = wa ? !dentroDeFranja(wa, partesMadrid(ahora).minutos) && partesMadrid(ahora).minutos >= wa.hasta : true;
    const enviosAuto = async (ids: string[], plantilla: string) => {
      if (!ids.length) return new Map<string, { estado: string | null; error: string | null }>();
      const filas = await db()
        .select({ citaId: mensajes.citaId, estado: mensajes.estado, error: mensajes.error })
        .from(mensajes)
        .where(and(eq(mensajes.canal, "whatsapp_api"), eq(mensajes.plantilla, plantilla), inArray(mensajes.citaId, ids)))
        .orderBy(asc(mensajes.cuando));
      return new Map(filas.map((f) => [f.citaId!, { estado: f.estado, error: f.error }]));
    };
    const avisosDeCitas = async (
      plantilla: "recordatorio" | "seguimiento",
      lista0: Awaited<ReturnType<typeof citasDelDia>>,
      auto: boolean,
      texto: (c: Awaited<ReturnType<typeof citasDelDia>>[number]) => { titulo: string; detalle?: string; prioridad: PrioridadAviso },
    ) => {
      const datos = await fichas(lista0.map((c) => c.cliente.id));
      const envios = auto ? await enviosAuto(lista0.map((c) => c.id), plantilla) : new Map();
      for (const c of lista0) {
        const f = datos.find((x) => x.id === c.cliente.id);
        if (!f || f.anonimizadaEn) continue;
        const envio = envios.get(c.id);
        const mensaje = { clienteId: f.id, plantilla, citaId: c.id, noDisponible: disponible(f, "cita") };
        if (auto && envio?.estado === "fallido") {
          lista.push({
            clave: `${plantilla}:${c.id}`,
            prioridad: "importante",
            titulo: `No se pudo enviar ${plantilla === "recordatorio" ? "el recordatorio" : "el «qué tal»"} a ${c.cliente.nombre}.`,
            detalle: envio.error ?? undefined,
            mensaje,
          });
          continue;
        }
        if (auto && (envio || (!yaPasoLaHora && !mensaje.noDisponible))) continue;
        lista.push({ clave: `${plantilla}:${c.id}`, ...texto(c), mensaje });
      }
    };

    if (ajustes.recordatorios || autoActivo("recordatorio", wa?.recordatorios)) {
      const auto = autoActivo("recordatorio", wa?.recordatorios);
      const manana = (await citasDelDia(sumarDias(hoy, 1))).filter((c) => c.estado === "confirmada" || (auto && c.estado === "pendiente"));
      await avisosDeCitas("recordatorio", manana, auto, (c) => ({
        prioridad: "pendiente",
        titulo: `Recordar a ${c.cliente.nombre} su cita de mañana a las ${horaATexto(partesMadrid(c.inicio).minutos)}.`,
        detalle: c.servicios.join(" + "),
      }));
    }

    if (ajustes.seguimiento || autoActivo("seguimiento", wa?.seguimiento)) {
      const ayer = (await citasDelDia(sumarDias(hoy, -1))).filter((c) => c.estado === "realizada");
      await avisosDeCitas("seguimiento", ayer, autoActivo("seguimiento", wa?.seguimiento), (c) => ({
        prioridad: "informativo",
        titulo: `Preguntar a ${c.cliente.nombre} qué tal su ${c.servicios.join(" y ")} de ayer.`,
      }));
    }

    // Consentimientos que hay que firmar antes de las citas de hoy y mañana.
    const proximas = [...(await citasDelDia(hoy)), ...(await citasDelDia(sumarDias(hoy, 1)))].filter((c) => c.estado === "pendiente" || c.estado === "confirmada");
    const faltan = await consentimientosQueFaltan(proximas.map((c) => ({ id: c.id, clienteId: c.cliente.id })));
    for (const c of proximas) {
      for (const m of faltan.get(c.id) ?? []) {
        const p = partesMadrid(c.inicio);
        lista.push({
          clave: `consentimiento:${c.id}:${m.id}`,
          prioridad: "importante",
          titulo: `${c.cliente.nombre} tiene que firmar «${m.nombre}» antes de su cita.`,
          detalle: `${p.fecha === hoy ? "Hoy" : "Mañana"} a las ${horaATexto(p.minutos)}`,
          enlace: `/gestion/clientas/${c.cliente.id}/consentimiento?modelo=${m.id}&cita=${c.id}`,
        });
      }
    }

    // Lo que han escrito las clientas por WhatsApp (lo que la app no ha resuelto sola) en la última semana.
    const escritos = await db()
      .select({ m: mensajes, nombre: clientes.nombre })
      .from(mensajes)
      .leftJoin(clientes, eq(clientes.id, mensajes.clienteId))
      .where(and(eq(mensajes.direccion, "entrante"), gt(mensajes.cuando, new Date(ahora.getTime() - 7 * 86_400_000))))
      .orderBy(desc(mensajes.cuando))
      .limit(50);
    for (const { m, nombre } of escritos) {
      const quien = nombre ?? `El ${m.telefono ? formatearTelefono(m.telefono) : "número"} (sin ficha)`;
      const cambiar = entenderRespuesta(m.texto, m.boton) === "cambiar";
      lista.push({
        clave: `respuesta:${m.id}`,
        prioridad: cambiar ? "importante" : "pendiente",
        titulo: cambiar ? `${quien} quiere cambiar su cita.` : `${quien} ha escrito por WhatsApp.`,
        detalle: `«${m.texto.length > 160 ? `${m.texto.slice(0, 160)}…` : m.texto}»`,
        enlace: m.clienteId ? `/gestion/clientas/${m.clienteId}#whatsapp` : undefined,
      });
    }

    if (ajustes.bonos && ver("cobrar")) {
      const bonos = await bonosPorAcabar();
      const datos = await fichas(bonos.map((b) => b.clienteId));
      for (const b of bonos) {
        const f = datos.find((x) => x.id === b.clienteId);
        if (!f) continue;
        lista.push({
          clave: `bono:${b.id}:${b.usadas}`,
          prioridad: "pendiente",
          titulo: `A ${b.clienta} le ${textoQuedan(b.sesiones - b.usadas)} de su ${b.nombre}: ofrécele renovarlo.`,
          enlace: `/gestion/mas/bonos/${b.id}`,
          mensaje: { clienteId: f.id, plantilla: "renovar_bono", bonoId: b.id, noDisponible: disponible(f, "cita") },
        });
      }
    }

    if (ajustes.cumpleanos) {
      const conFecha = await db().select().from(clientes).where(and(isNotNull(clientes.fechaNacimiento), isNull(clientes.anonimizadaEn)));
      for (const f of conFecha.filter((x) => esCumpleanos(x.fechaNacimiento, hoy))) {
        lista.push({
          clave: `cumpleanos:${f.id}:${hoy.slice(0, 4)}`,
          prioridad: "informativo",
          titulo: `Hoy cumple años ${f.nombre}.`,
          mensaje: { clienteId: f.id, plantilla: "cumpleanos", noDisponible: disponible(f, "promocion") },
        });
      }
    }

    if (ajustes.diasInactiva > 0) {
      const filas = await db()
        .select({
          c: clientes,
          ultima: sql<string | null>`(select to_char(max(ci.inicio at time zone 'Europe/Madrid'), 'YYYY-MM-DD') from citas ci where ci.cliente_id = "clientes"."id" and ci.estado = 'realizada')`,
          proxima: sql<boolean>`exists (select 1 from citas ci where ci.cliente_id = "clientes"."id" and ci.inicio > now() and ci.estado in ('pendiente', 'confirmada'))`,
        })
        .from(clientes)
        .where(isNull(clientes.anonimizadaEn));
      const inactivas = filas.filter((x) => estaInactiva(x.ultima, x.proxima, hoy, ajustes.diasInactiva)).slice(0, 10);
      for (const { c, ultima } of inactivas) {
        lista.push({
          clave: `inactiva:${c.id}:${ultima}`,
          prioridad: "informativo",
          titulo: `${c.nombre} no viene desde el ${diaLargo(ultima!)}.`,
          enlace: `/gestion/clientas/${c.id}`,
          mensaje: { clienteId: c.id, plantilla: "te_echamos_de_menos", noDisponible: disponible(c, "promocion") },
        });
      }
    }
  }

  // Tareas apuntadas a mano: las de hoy, las atrasadas y las que no tienen fecha.
  const pendientes = await db()
    .select({ t: tareas, clienta: clientes.nombre })
    .from(tareas)
    .leftJoin(clientes, eq(clientes.id, tareas.clienteId))
    .where(and(isNull(tareas.hechaEn), or(isNull(tareas.fecha), lte(tareas.fecha, hoy))))
    .orderBy(asc(tareas.fecha), asc(tareas.creadaEn));
  for (const { t, clienta } of pendientes) {
    lista.push({
      tareaId: t.id,
      prioridad: t.fecha && t.fecha < hoy ? "importante" : "pendiente",
      titulo: t.texto,
      detalle: [clienta, t.fecha && t.fecha < hoy ? `era para el ${diaLargo(t.fecha)}` : null].filter(Boolean).join(" · ") || undefined,
      enlace: t.clienteId ? `/gestion/clientas/${t.clienteId}` : undefined,
    });
  }

  // Lo ya atendido o pospuesto no sale.
  const claves = lista.flatMap((a) => (a.clave ? [a.clave] : []));
  const atendidos = claves.length ? await db().select().from(avisosAtendidos).where(inArray(avisosAtendidos.clave, claves)) : [];
  const ocultos = new Set(atendidos.filter((a) => a.posponerHasta === null || a.posponerHasta >= hoy).map((a) => a.clave));
  const visibles = lista.filter((a) => !a.clave || !ocultos.has(a.clave));
  // Si la plantilla está aprobada en Meta, el botón envía desde la app en lugar de abrir WhatsApp.
  if (apiWhatsapp()) {
    const aprobadas = new Set((await db().select().from(plantillas)).filter((p) => plantillaMeta(p)).map((p) => p.clave));
    for (const a of visibles) if (a.mensaje && aprobadas.has(a.mensaje.plantilla)) a.mensaje.api = true;
  }
  return ordenarPorPrioridad(visibles);
}

/** Marca un aviso como hecho (o lo pospone hasta un día). */
export async function atenderAviso(clave: string, usuarioId: string | null, posponerHasta: string | null, tx?: Tx) {
  await (tx ?? db())
    .insert(avisosAtendidos)
    .values({ clave, posponerHasta, usuarioId })
    .onConflictDoUpdate({ target: avisosAtendidos.clave, set: { posponerHasta, usuarioId, cuando: new Date() } });
}

export async function plantillasGuardadas() {
  return db().select().from(plantillas).orderBy(asc(plantillas.nombre));
}
