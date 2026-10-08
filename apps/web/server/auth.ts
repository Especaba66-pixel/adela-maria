import "server-only";
import { dispositivos, registrarActividad, sesiones, usuarios } from "@adela/db";
import {
  cifrarSecreto,
  comprobarSecreto,
  estaBloqueado,
  normalizarUsuario,
  puede,
  sesionCaducada,
  trasIntentoFallido,
  type Permiso,
  type Rol,
} from "@adela/dominio";
import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { db } from "./db";

const COOKIE_SESION = "am_sesion";
const COOKIE_DISPOSITIVO = "am_dispositivo";
const UN_ANO = 60 * 60 * 24 * 365;

export interface UsuarioSesion {
  id: string;
  nombre: string;
  rol: Rol;
}
export interface Sesion {
  id: string;
  usuario: UsuarioSesion;
  metodo: "contrasena" | "pin";
}

export function minutosInactividad(): number {
  return Number(process.env.SESION_MINUTOS_INACTIVIDAD ?? 15);
}

const nuevoToken = () => randomBytes(32).toString("base64url");
const huella = (token: string) => createHash("sha256").update(token).digest("hex");

async function opcionesCookie(maxAge?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(maxAge ? { maxAge } : {}),
  };
}

// ── Lectura de la sesión ─────────────────────────────────────────────────────

/** La sesión de esta petición, o null. Caduca por inactividad. */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  if (!token) return null;
  const [fila] = await db()
    .select({ sesion: sesiones, usuario: usuarios })
    .from(sesiones)
    .innerJoin(usuarios, eq(usuarios.id, sesiones.usuarioId))
    .where(and(eq(sesiones.hashToken, huella(token)), isNull(sesiones.cerradaEn)));
  if (!fila || !fila.usuario.activo) return null;

  const ahora = new Date();
  if (sesionCaducada(fila.sesion.ultimaActividad, ahora, minutosInactividad())) {
    await db().update(sesiones).set({ cerradaEn: ahora }).where(eq(sesiones.id, fila.sesion.id));
    await registrarActividad(db(), { usuarioId: fila.usuario.id, accion: "sesion.caducada", entidad: "sesiones", entidadId: fila.sesion.id });
    return null;
  }
  // Basta con apuntar la actividad una vez por minuto.
  if (ahora.getTime() - fila.sesion.ultimaActividad.getTime() > 60_000) {
    await db().update(sesiones).set({ ultimaActividad: ahora }).where(eq(sesiones.id, fila.sesion.id));
  }
  return {
    id: fila.sesion.id,
    metodo: fila.sesion.metodo,
    usuario: { id: fila.usuario.id, nombre: fila.usuario.nombre, rol: fila.usuario.rol },
  };
});

/** Para páginas y acciones: exige sesión y, si se indica, un permiso. */
export async function requerirSesion(permiso?: Permiso): Promise<Sesion> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect((await dispositivoActual()) ? "/pin" : "/entrar");
  if (permiso && !puede(sesion.usuario.rol, permiso)) redirect("/sin-permiso");
  return sesion;
}

/** El equipo de confianza (TPV) desde el que se hace la petición, si lo es. */
export const dispositivoActual = cache(async () => {
  const token = (await cookies()).get(COOKIE_DISPOSITIVO)?.value;
  if (!token) return null;
  const [d] = await db()
    .select()
    .from(dispositivos)
    .where(and(eq(dispositivos.hashToken, huella(token)), isNull(dispositivos.revocadoEn)));
  return d ?? null;
});

// ── Entrar y salir ───────────────────────────────────────────────────────────

type Resultado = { ok: true } | { ok: false; error: string };
const ERROR_GENERICO = "Usuario o contraseña incorrectos.";

// Hash de relleno: si el usuario no existe se tarda lo mismo que si existe.
let hashRelleno: Promise<string> | undefined;
const relleno = () => (hashRelleno ??= cifrarSecreto("relleno"));

async function crearSesion(usuarioId: string, metodo: "contrasena" | "pin", dispositivoId: string | null) {
  const token = nuevoToken();
  const [s] = await db()
    .insert(sesiones)
    .values({ hashToken: huella(token), usuarioId, metodo, dispositivoId })
    .returning({ id: sesiones.id });
  (await cookies()).set(COOKIE_SESION, token, await opcionesCookie());
  return s!.id;
}

/** Apunta un intento fallido. Devuelve hasta cuándo queda bloqueado, si este intento lo bloquea. */
async function anotarFallo(u: typeof usuarios.$inferSelect, motivo: string): Promise<Date | null> {
  const { intentos, bloqueadoHasta } = trasIntentoFallido(u.intentosFallidos, new Date());
  await db().update(usuarios).set({ intentosFallidos: intentos, bloqueadoHasta }).where(eq(usuarios.id, u.id));
  await registrarActividad(db(), {
    usuarioId: u.id,
    accion: bloqueadoHasta ? "sesion.bloqueo" : "sesion.fallo",
    entidad: "usuarios",
    entidadId: u.id,
    despues: { motivo },
  });
  return bloqueadoHasta;
}

function mensajeBloqueo(hasta: Date): string {
  const minutos = Math.max(1, Math.ceil((hasta.getTime() - Date.now()) / 60_000));
  return `Demasiados intentos. Prueba de nuevo en ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`;
}

export async function entrarConContrasena(datos: {
  usuario: string;
  contrasena: string;
  recordarComoTpv: boolean;
}): Promise<Resultado> {
  const [u] = await db().select().from(usuarios).where(eq(usuarios.usuario, normalizarUsuario(datos.usuario)));
  if (!u || !u.activo) {
    await comprobarSecreto(datos.contrasena, await relleno());
    return { ok: false, error: ERROR_GENERICO };
  }
  if (estaBloqueado(u.bloqueadoHasta, new Date())) return { ok: false, error: mensajeBloqueo(u.bloqueadoHasta!) };
  if (!(await comprobarSecreto(datos.contrasena, u.hashContrasena))) {
    const bloqueo = await anotarFallo(u, "contraseña");
    return { ok: false, error: bloqueo ? mensajeBloqueo(bloqueo) : ERROR_GENERICO };
  }

  await db().update(usuarios).set({ intentosFallidos: 0, bloqueadoHasta: null }).where(eq(usuarios.id, u.id));
  let dispositivo = await dispositivoActual();
  // Solo la administración puede marcar un equipo como TPV de confianza.
  if (datos.recordarComoTpv && !dispositivo && u.rol === "administrador") {
    const token = nuevoToken();
    const [nuevo] = await db()
      .insert(dispositivos)
      .values({ hashToken: huella(token), nombre: "TPV", registradoPor: u.id })
      .returning();
    dispositivo = nuevo!;
    (await cookies()).set(COOKIE_DISPOSITIVO, token, await opcionesCookie(UN_ANO));
    await registrarActividad(db(), { usuarioId: u.id, accion: "dispositivo.registrar", entidad: "dispositivos", entidadId: dispositivo.id });
  }
  const sesionId = await crearSesion(u.id, "contrasena", dispositivo?.id ?? null);
  await registrarActividad(db(), { usuarioId: u.id, accion: "sesion.entrar", entidad: "sesiones", entidadId: sesionId, despues: { metodo: "contraseña" } });
  return { ok: true };
}

export async function entrarConPin(usuarioId: string, pin: string): Promise<Resultado> {
  const dispositivo = await dispositivoActual();
  if (!dispositivo) return { ok: false, error: "Este equipo no está autorizado para entrar con PIN." };
  const [u] = await db().select().from(usuarios).where(eq(usuarios.id, usuarioId));
  if (!u || !u.activo || !u.hashPin) return { ok: false, error: "PIN incorrecto." };
  if (estaBloqueado(u.bloqueadoHasta, new Date())) return { ok: false, error: mensajeBloqueo(u.bloqueadoHasta!) };
  if (!(await comprobarSecreto(pin, u.hashPin))) {
    const bloqueo = await anotarFallo(u, "PIN");
    return { ok: false, error: bloqueo ? mensajeBloqueo(bloqueo) : "PIN incorrecto." };
  }
  await db().update(usuarios).set({ intentosFallidos: 0, bloqueadoHasta: null }).where(eq(usuarios.id, u.id));
  await db().update(dispositivos).set({ ultimoUso: new Date() }).where(eq(dispositivos.id, dispositivo.id));
  const sesionId = await crearSesion(u.id, "pin", dispositivo.id);
  await registrarActividad(db(), { usuarioId: u.id, accion: "sesion.entrar", entidad: "sesiones", entidadId: sesionId, despues: { metodo: "PIN" } });
  return { ok: true };
}

/** Cierra la sesión. Devuelve adónde ir: al PIN si es el TPV, si no a la pantalla de entrada. */
export async function salir(): Promise<"/pin" | "/entrar"> {
  const sesion = await obtenerSesion();
  if (sesion) {
    await db().update(sesiones).set({ cerradaEn: new Date() }).where(eq(sesiones.id, sesion.id));
    await registrarActividad(db(), { usuarioId: sesion.usuario.id, accion: "sesion.salir", entidad: "sesiones", entidadId: sesion.id });
  }
  (await cookies()).delete(COOKIE_SESION);
  return (await dispositivoActual()) ? "/pin" : "/entrar";
}
