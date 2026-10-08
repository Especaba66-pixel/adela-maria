import "server-only";
import { conectar, type BaseDatos } from "@adela/db";

const global = globalThis as unknown as { __adelaDb?: BaseDatos };

/** Una sola conexión por proceso (también al recargar en desarrollo). */
export function db(): BaseDatos {
  if (!global.__adelaDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Falta DATABASE_URL");
    global.__adelaDb = conectar(url).db;
  }
  return global.__adelaDb;
}
