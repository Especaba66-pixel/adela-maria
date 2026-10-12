import "server-only";
import { bonos, citas, clientes, cobros, movimientosTarjetaRegalo, tarjetasRegalo, tratamientos, usosBono, usuarios } from "@adela/db";
import { BONO_CASI_AGOTADO, estadoBono, hoyEnMadrid } from "@adela/dominio";
import { asc, desc, eq, sql } from "drizzle-orm";
import { requerirSesion } from "./auth";
import { db } from "./db";

const usadas = sql<number>`coalesce((select sum(u.cantidad) from usos_bono u where u.bono_id = "bonos"."id"), 0)::int`;

/** Bonos de una clienta (para el TPV y su ficha). */
export async function bonosDeClienta(clienteId: string) {
  await requerirSesion("cobrar");
  const hoy = hoyEnMadrid(new Date());
  return (await cobros.bonosDeCliente(db(), clienteId)).map((b) => ({ ...b, estado: estadoBono(b, hoy) }));
}

/** Todos los bonos vendidos, con su clienta y su estado. */
export async function listaBonos() {
  await requerirSesion("cobrar");
  const hoy = hoyEnMadrid(new Date());
  const filas = await db()
    .select({ id: bonos.id, nombre: bonos.nombre, sesiones: bonos.sesiones, caducaEn: bonos.caducaEn, anuladoEn: bonos.anuladoEn, compradoEn: bonos.compradoEn, usadas, clienteId: clientes.id, clienta: clientes.nombre })
    .from(bonos)
    .innerJoin(clientes, eq(clientes.id, bonos.clienteId))
    .orderBy(desc(bonos.compradoEn));
  return filas.map((b) => ({ ...b, estado: estadoBono({ ...b, anulado: b.anuladoEn !== null }, hoy) }));
}

/** Bonos activos a los que les queda una sesión: es el momento de ofrecer otro. */
export async function bonosPorAcabar() {
  return (await listaBonos()).filter((b) => b.estado === "activo" && b.sesiones - b.usadas <= BONO_CASI_AGOTADO);
}

/** Un bono con su historial de sesiones. */
export async function detalleBono(id: string) {
  await requerirSesion("cobrar");
  const [b] = await db()
    .select({ bono: bonos, usadas, clienta: clientes.nombre })
    .from(bonos)
    .innerJoin(clientes, eq(clientes.id, bonos.clienteId))
    .where(eq(bonos.id, id));
  if (!b) return null;
  const historial = await db()
    .select({ id: usosBono.id, cantidad: usosBono.cantidad, cuando: usosBono.cuando, motivo: usosBono.motivo, tratamiento: tratamientos.nombre, citaInicio: citas.inicio, quien: usuarios.nombre })
    .from(usosBono)
    .innerJoin(usuarios, eq(usuarios.id, usosBono.usuarioId))
    .leftJoin(tratamientos, eq(tratamientos.id, usosBono.tratamientoId))
    .leftJoin(citas, eq(citas.id, usosBono.citaId))
    .where(eq(usosBono.bonoId, id))
    .orderBy(asc(usosBono.id));
  const estado = estadoBono({ ...b.bono, usadas: b.usadas, anulado: b.bono.anuladoEn !== null }, hoyEnMadrid(new Date()));
  return { ...b.bono, usadas: b.usadas, clienta: b.clienta, estado, historial };
}

/** Tarjetas regalo vendidas, con su saldo. */
export async function listaTarjetas() {
  await requerirSesion("cobrar");
  return db()
    .select({
      id: tarjetasRegalo.id,
      codigo: tarjetasRegalo.codigo,
      importeInicial: tarjetasRegalo.importeInicial,
      para: tarjetasRegalo.para,
      creadaEn: tarjetasRegalo.creadaEn,
      anuladaEn: tarjetasRegalo.anuladaEn,
      saldo: sql<number>`coalesce((select sum(${movimientosTarjetaRegalo.importe}) from ${movimientosTarjetaRegalo} where ${movimientosTarjetaRegalo.tarjetaId} = "tarjetas_regalo"."id"), 0)::int`,
    })
    .from(tarjetasRegalo)
    .orderBy(desc(tarjetasRegalo.creadaEn));
}
