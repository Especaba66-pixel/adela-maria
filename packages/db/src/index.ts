import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as esquema from "./esquema";

export * from "./esquema";
export { registrarActividad, type Actividad } from "./actividad";
export { sembrar, NOMBRE_CENTRO, type AdminInicial, type ResumenSiembra } from "./sembrar";
export { esquema };

export type BaseDatos = PostgresJsDatabase<typeof esquema>;
/** Una transacción admite las mismas operaciones que la base de datos. */
export type Tx = Parameters<Parameters<BaseDatos["transaction"]>[0]>[0];

export function conectar(url: string, opciones: { max?: number } = {}) {
  const cliente = postgres(url, { max: opciones.max ?? 10, onnotice: () => {} });
  const db = drizzle(cliente, { schema: esquema, casing: "snake_case" });
  return { db, cerrar: () => cliente.end() };
}
