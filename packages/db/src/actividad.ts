import { registroActividad } from "./esquema";
import type { BaseDatos, Tx } from "./index";

export interface Actividad {
  usuarioId: string | null;
  accion: string;
  entidad?: string;
  entidadId?: string;
  antes?: unknown;
  despues?: unknown;
}

/** Quita los campos secretos antes de guardar un "antes" o "después". */
function sinSecretos(valor: unknown): unknown {
  if (valor === null || typeof valor !== "object") return valor ?? null;
  const copia: Record<string, unknown> = { ...(valor as Record<string, unknown>) };
  for (const clave of Object.keys(copia)) if (/^hash/i.test(clave)) copia[clave] = "[oculto]";
  return copia;
}

/** Deja rastro de un cambio. Llamarla dentro de la misma transacción que el cambio. */
export async function registrarActividad(db: BaseDatos | Tx, a: Actividad): Promise<void> {
  await db.insert(registroActividad).values({
    usuarioId: a.usuarioId,
    accion: a.accion,
    entidad: a.entidad ?? null,
    entidadId: a.entidadId ?? null,
    antes: sinSecretos(a.antes),
    despues: sinSecretos(a.despues),
  });
}
