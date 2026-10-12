import "server-only";
import { centro, registrarActividad } from "@adela/db";
import { normalizarTelefono, validarNif } from "@adela/dominio";
import { eq } from "drizzle-orm";
import { requerirSesion } from "./auth";
import { db } from "./db";

export type Resultado = { ok: true; mensaje: string } | { ok: false; error: string };

/** Datos del centro que se ven en la web de clientas. Solo administración. */
export async function guardarDatosCentro(datos: {
  telefono: string;
  direccion: string;
  cabinas: string;
  nombreFiscal: string;
  nif: string;
  direccionFiscal: string;
  pieTicket: string;
}): Promise<Resultado> {
  const { usuario } = await requerirSesion("configuracion.gestionar");
  let telefono: string | null = null;
  if (datos.telefono.trim()) {
    telefono = normalizarTelefono(datos.telefono);
    if (!telefono) return { ok: false, error: "Revisa el teléfono: debe ser un número español de 9 cifras." };
  }
  const direccion = datos.direccion.trim().replace(/\s+/g, " ") || null;
  if (direccion && direccion.length > 200) return { ok: false, error: "La dirección es demasiado larga." };
  const cabinas = Number(datos.cabinas);
  if (!Number.isInteger(cabinas) || cabinas < 1 || cabinas > 20) return { ok: false, error: "Indica cuántas cabinas hay (de 1 a 20)." };
  let nif: string | null = null;
  if (datos.nif.trim()) {
    nif = validarNif(datos.nif);
    if (!nif) return { ok: false, error: "Revisa el NIF: la letra no cuadra." };
  }
  const nombreFiscal = datos.nombreFiscal.trim() || null;
  const direccionFiscal = datos.direccionFiscal.trim().replace(/\s+/g, " ") || null;
  const pieTicket = datos.pieTicket.trim().slice(0, 200) || null;

  const [antes] = await db().select().from(centro).limit(1);
  if (!antes) return { ok: false, error: "No hay datos del centro." };
  await db().transaction(async (tx) => {
    const [despues] = await tx.update(centro).set({ telefono, direccion, cabinas, nombreFiscal, nif, direccionFiscal, pieTicket }).where(eq(centro.id, antes.id)).returning();
    await registrarActividad(tx, { usuarioId: usuario.id, accion: "centro.editar", entidad: "centro", entidadId: antes.id, antes, despues });
  });
  return { ok: true, mensaje: "Guardado. Ya se ve en la web de clientas." };
}
