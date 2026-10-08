import { execSync } from "node:child_process";
import { ENTORNO_PRUEBAS } from "../playwright.config";

/** Base de datos de pruebas vacía, con migraciones y datos iniciales. */
export default function preparar() {
  const env = { ...process.env, ...ENTORNO_PRUEBAS };
  const vaciar = "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;";
  execSync(`psql "${ENTORNO_PRUEBAS.DATABASE_URL}" -q -v ON_ERROR_STOP=1 -c "${vaciar}"`, {
    env: { ...env, PGOPTIONS: "-c client_min_messages=warning" },
    stdio: "inherit",
  });
  execSync("pnpm --silent db:migrate", { env, stdio: "inherit" });
  execSync("pnpm --silent db:seed", { env, stdio: "inherit" });
  // Tarifas de prueba (las reales aún no se han cargado).
  const tarifas = `
    insert into tratamientos (categoria_id, nombre, duracion_minutos, precio_centimos, orden)
    select id, 'Higiene facial', 60, 4500, 0 from categorias where nombre = 'Faciales'
    union all select id, 'Labio superior', 5, 300, 0 from categorias where nombre = 'Depilación';`;
  execSync(`psql "${ENTORNO_PRUEBAS.DATABASE_URL}" -q -v ON_ERROR_STOP=1`, { input: tarifas, env, stdio: ["pipe", "inherit", "inherit"] });
}
