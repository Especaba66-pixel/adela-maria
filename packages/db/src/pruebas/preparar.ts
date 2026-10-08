import "../entorno";
import postgres from "postgres";
import { conectar } from "../index";
import { migrar } from "../scripts/migrar";

/** Vacía la base de datos de pruebas, aplica las migraciones y devuelve una conexión. */
export async function baseDePruebas() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("Falta DATABASE_URL_TEST en .env");
  const admin = postgres(url, { max: 1, onnotice: () => {} });
  await admin.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await admin.end();
  await migrar(url);
  return conectar(url, { max: 2 });
}
