import "server-only";
import { clavesPush, dispositivos, registrarActividad, suscripcionesPush, usuarios } from "@adela/db";
import { cabeceraVapid, cifrarPush, contenidoAviso, crearClavesPush, puede, validarSuscripcion, type AvisoPush, type ClavesPush, type Permiso, type SuscripcionPush } from "@adela/dominio";
import { and, eq } from "drizzle-orm";
import { dispositivoActual, requerirSesion } from "./auth";
import { db } from "./db";

/** A quién se identifica el centro ante Google y Apple al enviar (lo piden por si hubiera un problema con los envíos). */
const CONTACTO = "mailto:adelamaria_16@hotmail.com";
const permitirLocal = () => process.env.PUSH_PERMITIR_LOCAL === "1";

/** Las claves del remitente. Se crean la primera vez y no cambian (si cambiaran, habría que volver a activar los móviles). */
export async function clavesRemitente(): Promise<ClavesPush> {
  const [c] = await db().select().from(clavesPush).where(eq(clavesPush.id, 1));
  if (c) return { publica: c.publica, privada: c.privada };
  const nuevas = crearClavesPush();
  await db().insert(clavesPush).values({ id: 1, ...nuevas }).onConflictDoNothing();
  const [guardadas] = await db().select().from(clavesPush).where(eq(clavesPush.id, 1));
  return { publica: guardadas!.publica, privada: guardadas!.privada };
}

/** Este móvil quiere recibir avisos: se apunta a nombre de quien ha entrado y del equipo de confianza. */
export async function activarEnEsteEquipo(s: SuscripcionPush): Promise<{ ok: true } | { ok: false; error: string }> {
  const { usuario } = await requerirSesion();
  const error = validarSuscripcion(s, { permitirLocal: permitirLocal() });
  if (error) return { ok: false, error };
  const equipo = await dispositivoActual();
  await db()
    .insert(suscripcionesPush)
    .values({ usuarioId: usuario.id, dispositivoId: equipo?.id ?? null, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })
    .onConflictDoUpdate({ target: suscripcionesPush.endpoint, set: { usuarioId: usuario.id, dispositivoId: equipo?.id ?? null, p256dh: s.p256dh, auth: s.auth } });
  await registrarActividad(db(), { usuarioId: usuario.id, accion: "avisos.activar", entidad: "dispositivos", entidadId: equipo?.id });
  return { ok: true };
}

export async function desactivarEnEsteEquipo(endpoint: string): Promise<void> {
  const { usuario } = await requerirSesion();
  await db().delete(suscripcionesPush).where(and(eq(suscripcionesPush.endpoint, endpoint), eq(suscripcionesPush.usuarioId, usuario.id)));
  await registrarActividad(db(), { usuarioId: usuario.id, accion: "avisos.desactivar", entidad: "suscripciones_push" });
}

/** ¿Este móvil (por su suscripción) ya recibe avisos? */
export async function estaActivado(endpoint: string): Promise<boolean> {
  const [s] = await db().select({ id: suscripcionesPush.id }).from(suscripcionesPush).where(eq(suscripcionesPush.endpoint, endpoint));
  return Boolean(s);
}

/**
 * Manda un aviso a los móviles de las personas que pueden atenderlo. Nunca falla hacia fuera: si no se puede avisar,
 * el asunto sigue en el Inicio como siempre. Las suscripciones que el móvil ya no acepta se borran.
 */
export async function avisar(aviso: AvisoPush, permiso: Permiso): Promise<number> {
  try {
    const filas = await db()
      .select({ s: suscripcionesPush, rol: usuarios.rol, revocado: dispositivos.revocadoEn })
      .from(suscripcionesPush)
      .innerJoin(usuarios, and(eq(usuarios.id, suscripcionesPush.usuarioId), eq(usuarios.activo, true)))
      .leftJoin(dispositivos, eq(dispositivos.id, suscripcionesPush.dispositivoId));
    return await enviarA(
      filas.filter((f) => !f.revocado && puede(f.rol, permiso)).map((f) => f.s),
      aviso,
    );
  } catch (e) {
    console.error("Avisos al móvil:", e);
    return 0;
  }
}

/** Un aviso de prueba solo a este móvil, para comprobar que llegan. */
export async function enviarPrueba(endpoint: string): Promise<boolean> {
  const { usuario } = await requerirSesion();
  const [s] = await db()
    .select()
    .from(suscripcionesPush)
    .where(and(eq(suscripcionesPush.endpoint, endpoint), eq(suscripcionesPush.usuarioId, usuario.id)));
  if (!s) return false;
  return (await enviarA([s], { titulo: "Avisos activados", texto: "Así te llegarán los mensajes de las clientas y las reservas por internet.", url: "/gestion" })) === 1;
}

async function enviarA(destinos: (typeof suscripcionesPush.$inferSelect)[], aviso: AvisoPush): Promise<number> {
  if (!destinos.length) return 0;
  const claves = await clavesRemitente();
  const contenido = contenidoAviso(aviso);
  let enviados = 0;
  await Promise.all(
    destinos.map(async (s) => {
      try {
        const r = await fetch(s.endpoint, {
          method: "POST",
          headers: {
            Authorization: cabeceraVapid(s.endpoint, claves, CONTACTO),
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            TTL: String(24 * 3600),
            Urgency: "high",
          },
          body: new Uint8Array(cifrarPush(contenido, s)),
          signal: AbortSignal.timeout(10_000),
        });
        if (r.status === 404 || r.status === 410) {
          // El móvil ya no acepta avisos (se desinstaló o se quitó el permiso).
          await db().delete(suscripcionesPush).where(eq(suscripcionesPush.id, s.id));
        } else if (r.ok) {
          enviados++;
          await db().update(suscripcionesPush).set({ ultimoEnvio: new Date() }).where(eq(suscripcionesPush.id, s.id));
        } else {
          console.error(`Aviso al móvil rechazado (${r.status}):`, await r.text().catch(() => ""));
        }
      } catch (e) {
        console.error("Aviso al móvil:", e);
      }
    }),
  );
  return enviados;
}
