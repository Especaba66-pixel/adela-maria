import "server-only";
import {
  bloqueos,
  categorias,
  citas,
  clientes,
  consentimientos,
  horarios,
  registrarActividad,
  reservasOnline,
  solicitudesReserva,
  tratamientos,
  type Tx,
} from "@adela/db";
import { TEXTO_PRIVACIDAD, horaATexto, normalizarTelefono, partesMadrid } from "@adela/dominio";
import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, ne } from "drizzle-orm";
import { cabinas, crearCitas, profesionalesActivos, profesionalesQueHacen } from "./agenda";
import { db } from "./db";
import { avisar } from "./notificaciones";
import { apiWhatsapp, envioAutomatico, procesarEventos } from "./whatsapp";

/**
 * Reservas por internet. Las clientas reservan en el servicio de Cloudflare (siempre encendido); el TPV, cuando está
 * encendido, se trae las reservas nuevas a su agenda y le manda sus tratamientos, horario, cabinas y lo ocupado.
 */

export interface ReservaOnline {
  id: string;
  servicioId: string;
  servicioNombre: string;
  inicio: number;
  fin: number;
  nombre: string | null;
  telefono: string | null;
  nota: string | null;
  consentimiento: string | null;
  creada: number;
}

export type ResultadoSincronizacion = { ok: true; cuando: Date; importadas: number } | { ok: false; cuando: Date; error: string };

export type ResultadoWhatsapp = { ok: true; cuando: Date; recibidos: number; enviados: number; fallidos: number } | { ok: false; cuando: Date; error: string };

const estado = globalThis as typeof globalThis & {
  __ultimaSincronizacion?: ResultadoSincronizacion;
  __sincronizando?: Promise<ResultadoSincronizacion>;
  __ultimoWhatsapp?: ResultadoWhatsapp;
};

export const internetConfigurado = () => Boolean(process.env.RESERVAS_URL && process.env.RESERVAS_CLAVE);
export const ultimaSincronizacion = () => estado.__ultimaSincronizacion ?? null;
export const ultimoWhatsapp = () => estado.__ultimoWhatsapp ?? null;

/** Días hacia delante de agenda que se mandan (lo mismo que se puede reservar, y uno más). */
const DIAS_A_MANDAR = 62;

async function llamar(ruta: string, opciones: RequestInit = {}) {
  const r = await fetch(`${process.env.RESERVAS_URL!.replace(/\/+$/, "")}${ruta}`, {
    ...opciones,
    headers: { Authorization: `Bearer ${process.env.RESERVAS_CLAVE}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`El servicio de reservas respondió ${r.status}`);
  return r.json();
}

/** Trae las reservas nuevas y manda el estado de la agenda. Nunca dos a la vez. */
export function sincronizar(): Promise<ResultadoSincronizacion> {
  if (!internetConfigurado()) return Promise.resolve({ ok: false, cuando: new Date(), error: "Las reservas por internet no están configuradas." });
  estado.__sincronizando ??= (async () => {
    let r: ResultadoSincronizacion;
    try {
      const { reservas } = (await llamar("/api/sync/reservas")) as { reservas: ReservaOnline[] };
      const importadas: string[] = [];
      for (const reserva of reservas) {
        const resultado = await importarReserva(reserva);
        importadas.push(reserva.id);
        if (resultado !== "repetida") await avisar(avisoDeReserva(reserva, resultado), "reservas.gestionar");
      }
      await llamar("/api/sync", { method: "POST", body: JSON.stringify({ ...(await estadoAgenda()), importadas }) });
      r = { ok: true, cuando: new Date(), importadas: importadas.length };
    } catch (e) {
      console.error("Sincronización de reservas por internet:", e);
      r = { ok: false, cuando: new Date(), error: e instanceof Error ? e.message : String(e) };
    }
    estado.__ultimaSincronizacion = r;
    if (apiWhatsapp()) estado.__ultimoWhatsapp = await sincronizarWhatsapp();
    estado.__sincronizando = undefined;
    return r;
  })();
  return estado.__sincronizando;
}

/**
 * WhatsApp: se trae de Cloudflare lo que ha avisado Meta (estados y respuestas), lo aplica, le dice a Cloudflare que
 * ya lo tiene (y lo borra allí) y envía lo que toque enviar solo. Va aparte: si falla, las reservas siguen.
 */
async function sincronizarWhatsapp(): Promise<ResultadoWhatsapp> {
  try {
    let recibidos = 0;
    for (let vuelta = 0; vuelta < 10; vuelta++) {
      const { eventos } = (await llamar("/api/sync/whatsapp")) as { eventos: { id: number; cuerpo: string }[] };
      if (!eventos.length) break;
      recibidos += await procesarEventos(eventos.map((e) => e.cuerpo));
      await llamar("/api/sync/whatsapp", { method: "POST", body: JSON.stringify({ hasta: Math.max(...eventos.map((e) => e.id)) }) });
      if (eventos.length < 200) break;
    }
    const { enviados, fallidos } = await envioAutomatico();
    return { ok: true, cuando: new Date(), recibidos, enviados, fallidos };
  } catch (e) {
    console.error("WhatsApp:", e);
    return { ok: false, cuando: new Date(), error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Pasa una reserva de internet a la agenda como cita «por confirmar», igual que las reservas de la web del TPV.
 * Si esa hora ya no cabe (se llenó desde el centro mientras), queda como petición para llamar a la clienta.
 * Cada reserva se importa una sola vez, aunque falle el aviso de vuelta a internet.
 */
export async function importarReserva(r: ReservaOnline): Promise<"cita" | "peticion" | "repetida"> {
  const [ya] = await db().select().from(reservasOnline).where(eq(reservasOnline.id, r.id));
  if (ya) return "repetida";
  const telefono = r.telefono ? normalizarTelefono(r.telefono) : null;
  const nombre = r.nombre?.trim() || "Clienta de la web";
  const [t] = await db()
    .select()
    .from(tratamientos)
    .where(and(isNull(tratamientos.anuladoEn), /^[0-9a-f-]{36}$/.test(r.servicioId) ? eq(tratamientos.id, r.servicioId) : eq(tratamientos.nombre, r.servicioNombre)));
  const { fecha, minutos } = partesMadrid(new Date(r.inicio));
  const profesional = t ? (await profesionalesQueHacen([t.id]))[0] : undefined;

  return db().transaction(async (tx) => {
    let cliente = telefono ? (await tx.select().from(clientes).where(and(eq(clientes.telefono, telefono), isNull(clientes.anonimizadaEn))))[0] : undefined;
    if (!cliente) {
      [cliente] = await tx.insert(clientes).values({ nombre, telefono }).returning();
      await registrarActividad(tx, { usuarioId: null, accion: "clienta.crear", entidad: "clientes", entidadId: cliente!.id, despues: { origen: "internet" } });
    }
    await tx.insert(consentimientos).values({ clienteId: cliente!.id, tipo: "privacidad_reserva", aceptado: true, texto: r.consentimiento ?? TEXTO_PRIVACIDAD, canal: "web" });
    const nota = [nombre !== cliente!.nombre ? `Nombre dado en la web: ${nombre}` : null, r.nota].filter(Boolean).join(". ") || null;

    if (t && profesional) {
      try {
        // Punto de guardado: si la hora ya no cabe, se deshace solo la cita y se deja la petición.
        const hecha = await tx.transaction(async (st) => {
          const c = await crearCitas(
            { clienteId: cliente!.id, profesionalId: profesional.id, fecha, inicioMin: minutos, tratamientoIds: [t.id], nota, estado: "pendiente", origen: "web" },
            null,
            st,
          );
          if (!c.ok) throw new HoraOcupada();
          return c.valor[0]!;
        });
        await tx.insert(reservasOnline).values({ id: r.id, citaId: hecha });
        return "cita" as const;
      } catch (e) {
        if (!(e instanceof HoraOcupada)) throw e;
      }
    }
    const [s] = await tx
      .insert(solicitudesReserva)
      .values({
        tratamientoId: t?.id ?? (await algunTratamiento(tx)),
        fechaPreferida: fecha,
        franja: minutos < 14 * 60 ? "manana" : "tarde",
        nombre: nombre.slice(0, 80),
        telefono: telefono ?? "",
        nota: `Pidió ${r.servicioNombre} a las ${horaATexto(minutos)} por internet, pero esa hora ya no estaba libre en la agenda.${r.nota ? ` ${r.nota}` : ""}`.slice(0, 500),
        consentimientoTexto: r.consentimiento ?? TEXTO_PRIVACIDAD,
      })
      .returning();
    await tx.insert(reservasOnline).values({ id: r.id, solicitudId: s!.id });
    return "peticion" as const;
  });
}

class HoraOcupada extends Error {}

const DIA = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" });

/** Aviso al móvil de una reserva hecha en la web: lo que ha pedido, para cuándo y si cabía en la agenda. */
export function avisoDeReserva(r: ReservaOnline, resultado: "cita" | "peticion") {
  const cuando = `${DIA.format(new Date(r.inicio))} a las ${horaATexto(partesMadrid(new Date(r.inicio)).minutos)}`;
  const quien = r.nombre?.trim() || "Una clienta";
  return resultado === "cita"
    ? { titulo: "Nueva reserva por internet", texto: `${quien}: ${r.servicioNombre}, ${cuando}. Está en la agenda por confirmar.`, url: "/gestion/agenda" }
    : { titulo: "Reserva por internet sin hueco", texto: `${quien} pidió ${r.servicioNombre} el ${cuando}, pero esa hora ya no estaba libre. Hay que llamarla.`, url: "/gestion" };
}

/** Una petición necesita un tratamiento; si el de internet ya no existe, se apunta cualquiera (la nota dice cuál pidió). */
async function algunTratamiento(tx: Tx) {
  const [t] = await tx.select({ id: tratamientos.id }).from(tratamientos).limit(1);
  return t!.id;
}

/** Lo que necesita el servicio de internet para ofrecer horas: tratamientos, horario, cabinas y lo ocupado. */
export async function estadoAgenda() {
  const desde = new Date(Date.now() - 86_400_000);
  const hasta = new Date(Date.now() + DIAS_A_MANDAR * 86_400_000);
  const activas = await profesionalesActivos();
  const [lista, horario, ocupan, bloq, capacidad] = await Promise.all([
    db()
      .select({ t: tratamientos, categoria: categorias.nombre, ordenCategoria: categorias.orden })
      .from(tratamientos)
      .innerJoin(categorias, eq(categorias.id, tratamientos.categoriaId))
      .where(and(isNull(tratamientos.anuladoEn), isNull(categorias.anuladoEn), isNotNull(tratamientos.duracionMinutos)))
      .orderBy(asc(categorias.orden), asc(tratamientos.orden)),
    activas.length ? db().select().from(horarios).where(inArray(horarios.profesionalId, activas.map((p) => p.id))) : Promise.resolve([]),
    db()
      .select({ inicio: citas.inicio, fin: citas.fin, exclusiva: citas.exclusiva })
      .from(citas)
      .where(and(ne(citas.estado, "cancelada"), lt(citas.inicio, hasta), gt(citas.fin, desde))),
    db()
      .select({ inicio: bloqueos.inicio, fin: bloqueos.fin })
      .from(bloqueos)
      .where(and(isNull(bloqueos.anuladoEn), lt(bloqueos.inicio, hasta), gt(bloqueos.fin, desde))),
    cabinas(),
  ]);
  const reservables = [];
  for (const { t, categoria, ordenCategoria } of lista) {
    if ((await profesionalesQueHacen([t.id])).length === 0) continue;
    reservables.push({
      id: t.id,
      nombre: t.nombre,
      categoria,
      duracion: t.duracionMinutos!,
      exclusivo: t.exclusivo,
      precio: t.precioCentimos,
      orden: ordenCategoria * 1000 + t.orden,
    });
  }
  return {
    servicios: reservables,
    horario: horario.map((h) => ({ diaSemana: h.diaSemana, inicio: h.inicioMin, fin: h.finMin })),
    cabinas: capacidad,
    ocupado: [
      ...ocupan.map((c) => ({ inicio: c.inicio.getTime(), fin: c.fin.getTime(), exclusiva: c.exclusiva, bloqueo: false })),
      // Con una sola profesional, un bloqueo (vacaciones, descanso) cierra la agenda de internet.
      ...bloq.map((b) => ({ inicio: b.inicio.getTime(), fin: b.fin.getTime(), exclusiva: false, bloqueo: true })),
    ],
  };
}
