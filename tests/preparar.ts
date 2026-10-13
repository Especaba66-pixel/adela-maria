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
  // Los recorridos comprueban el límite de citas a la vez con 2 (el centro usa 3; la regla es la misma).
  execSync(`psql "${ENTORNO_PRUEBAS.DATABASE_URL}" -q -c "update centro set cabinas = 2"`, { env, stdio: "inherit" });
}
