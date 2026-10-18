/**
 * Roles y permisos. La tabla del plan maestro ("Seguridad, protección de datos y copias")
 * es la fuente de esta lista: si cambia allí, cambia aquí y en sus pruebas.
 */

export const ROLES = ["administrador", "recepcion", "profesional", "invitada"] as const;
export type Rol = (typeof ROLES)[number];

export const NOMBRE_ROL: Record<Rol, string> = {
  administrador: "Administración",
  recepcion: "Recepción",
  profesional: "Profesional",
  invitada: "Invitada (soporte)",
};

/**
 * Invitada: quien construye y mantiene el sistema para el centro. Puede hacer todo para configurar y dar soporte, pero no
 * es personal del centro: no cuenta como administración, no puede tocar a la administración y la administración le
 * puede quitar el acceso cuando quiera.
 */
export const ROLES_CON_CONTRASENA: readonly Rol[] = ["administrador", "invitada"];
export const usaContrasena = (rol: Rol) => ROLES_CON_CONTRASENA.includes(rol);

export const PERMISOS = [
  "agenda.ver_toda",
  "agenda.ver_propia",
  "agenda.gestionar",
  "clientas.gestionar",
  "reservas.gestionar",
  "fichas.ver_propias",
  "cobrar",
  "caja.abrir_cerrar",
  "facturas.anular",
  "bonos.corregir",
  "stock.gestionar",
  "gastos.gestionar",
  "informes.ver",
  "configuracion.gestionar",
  "usuarios.gestionar",
  "actividad.ver",
] as const;
export type Permiso = (typeof PERMISOS)[number];

const PERMISOS_POR_ROL: Record<Rol, readonly Permiso[]> = {
  administrador: PERMISOS,
  recepcion: ["agenda.ver_toda", "agenda.gestionar", "clientas.gestionar", "reservas.gestionar", "cobrar", "caja.abrir_cerrar", "stock.gestionar"],
  profesional: ["agenda.ver_propia", "fichas.ver_propias"],
  invitada: PERMISOS,
};

export function puede(rol: Rol, permiso: Permiso): boolean {
  return PERMISOS_POR_ROL[rol].includes(permiso);
}

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}
