import "../entorno";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { conectar } from "../index";

export const CARPETA_MIGRACIONES = fileURLToPath(new URL("../../migraciones", import.meta.url));

export async function migrar(url: string): Promise<void> {
  const { db, cerrar } = conectar(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: CARPETA_MIGRACIONES });
  } finally {
    await cerrar();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  await migrar(url);
  console.log("Migraciones aplicadas.");
}
