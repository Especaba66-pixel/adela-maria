/**
 * Roles y permisos. La tabla del plan maestro ("Seguridad, protección de datos y copias")
 * es la fuente de esta lista: si cambia allí, cambia aquí y en sus pruebas.
 */

export const ROLES = ["administrador", "recepcion", "profesional"] as const;
export type Rol = (typeof ROLES)[number];

export const NOMBRE_ROL: Record<Rol, string> = {
  administrador: "Administración",
  recepcion: "Recepción",
  profesional: "Profesional",
};

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
  "informes.ver",
  "configuracion.gestionar",
  "usuarios.gestionar",
  "actividad.ver",
] as const;
export type Permiso = (typeof PERMISOS)[number];

const PERMISOS_POR_ROL: Record<Rol, readonly Permiso[]> = {
  administrador: PERMISOS,
  recepcion: ["agenda.ver_toda", "agenda.gestionar", "clientas.gestionar", "reservas.gestionar", "cobrar", "caja.abrir_cerrar"],
  profesional: ["agenda.ver_propia", "fichas.ver_propias"],
};

export function puede(rol: Rol, permiso: Permiso): boolean {
  return PERMISOS_POR_ROL[rol].includes(permiso);
}

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}
