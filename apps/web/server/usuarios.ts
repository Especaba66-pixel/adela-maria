import "server-only";
import { centro, registrarActividad, sesiones, usuarios } from "@adela/db";
import { cifrarSecreto, esRol, normalizarUsuario, validarContrasena, validarPin, validarUsuario } from "@adela/dominio";
import { and, eq, isNull, ne } from "drizzle-orm";
import { requerirSesion } from "./auth";
import { db } from "./db";

export type Resultado = { ok: true; mensaje: string } | { ok: false; error: string };

export async function crearUsuario(datos: {
  nombre: string;
  usuario: string;
  rol: string;
  contrasena: string;
  pin: string;
}): Promise<Resultado> {
  const { usuario: yo } = await requerirSesion("usuarios.gestionar");
  const nombre = datos.nombre.trim();
  const usuario = normalizarUsuario(datos.usuario);
  if (!nombre) return { ok: false, error: "Escribe el nombre." };
  if (!esRol(datos.rol)) return { ok: false, error: "Elige un rol." };
  const esAdmin = datos.rol === "administrador";
  if (!datos.pin) return { ok: false, error: "Escribe un PIN: es como entra el personal." };
  const error =
    validarUsuario(usuario) ??
    validarPin(datos.pin) ??
    (esAdmin ? validarContrasena(datos.contrasena) : null);
  if (error) return { ok: false, error };

  const [existe] = await db().select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.usuario, usuario));
  if (existe) return { ok: false, error: "Ya hay alguien con ese usuario." };

  const [c] = await db().select({ id: centro.id }).from(centro).limit(1);
  // Solo la administración tiene contraseña (para registrar equipos).
  const hashContrasena = esAdmin ? await cifrarSecreto(datos.contrasena) : null;
  const hashPin = await cifrarSecreto(datos.pin);
  await db().transaction(async (tx) => {
    const [nuevo] = await tx
      .insert(usuarios)
      .values({ centroId: c!.id, nombre, usuario, rol: datos.rol as never, hashContrasena, hashPin })
      .returning();
    await registrarActividad(tx, { usuarioId: yo.id, accion: "usuario.crear", entidad: "usuarios", entidadId: nuevo!.id, despues: nuevo });
  });
  return { ok: true, mensaje: `${nombre} ya puede entrar.` };
}

async function cerrarSesionesDe(tx: Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0], usuarioId: string) {
  await tx.update(sesiones).set({ cerradaEn: new Date() }).where(and(eq(sesiones.usuarioId, usuarioId), isNull(sesiones.cerradaEn)));
}

export async function editarUsuario(
  id: string,
  cambios: { rol?: string; activo?: boolean; contrasena?: string; pin?: string },
): Promise<Resultado> {
  const { usuario: yo } = await requerirSesion("usuarios.gestionar");
  const [antes] = await db().select().from(usuarios).where(eq(usuarios.id, id));
  if (!antes) return { ok: false, error: "No existe ese usuario." };

  const valores: Partial<typeof usuarios.$inferInsert> = {};
  if (cambios.rol !== undefined && cambios.rol !== antes.rol) {
    if (!esRol(cambios.rol)) return { ok: false, error: "Rol no válido." };
    valores.rol = cambios.rol;
  }
  if (cambios.activo !== undefined && cambios.activo !== antes.activo) valores.activo = cambios.activo;
  if (cambios.contrasena) {
    const error = validarContrasena(cambios.contrasena);
    if (error) return { ok: false, error };
    valores.hashContrasena = await cifrarSecreto(cambios.contrasena);
  }
  if (cambios.pin) {
    const error = validarPin(cambios.pin);
    if (error) return { ok: false, error };
    valores.hashPin = await cifrarSecreto(cambios.pin);
  }
  if (Object.keys(valores).length === 0) return { ok: true, mensaje: "No había nada que cambiar." };
  if (valores.rol === "administrador" && !antes.hashContrasena && !valores.hashContrasena) {
    return { ok: false, error: "Para dar administración hay que ponerle también una contraseña." };
  }

  // Siempre debe quedar al menos una persona con administración activa.
  const dejaDeSerAdmin = antes.rol === "administrador" && ((valores.rol && valores.rol !== "administrador") || valores.activo === false);
  if (dejaDeSerAdmin) {
    const otros = await db()
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.rol, "administrador"), eq(usuarios.activo, true), ne(usuarios.id, id)));
    if (otros.length === 0) return { ok: false, error: "Tiene que quedar al menos una persona con administración." };
  }

  await db().transaction(async (tx) => {
    const [despues] = await tx.update(usuarios).set(valores).where(eq(usuarios.id, id)).returning();
    // Si cambia el acceso, se cierran sus sesiones abiertas (salvo la propia al cambiar solo el PIN).
    if (valores.activo === false || valores.rol || (valores.hashContrasena && id !== yo.id)) await cerrarSesionesDe(tx, id);
    await registrarActividad(tx, { usuarioId: yo.id, accion: "usuario.editar", entidad: "usuarios", entidadId: id, antes, despues });
  });
  return { ok: true, mensaje: "Cambios guardados." };
}
