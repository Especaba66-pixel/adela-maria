import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

config({ quiet: true });
const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("Falta DATABASE_URL_TEST en .env");

const PUERTO = 3100;
export const ENTORNO_PRUEBAS = {
  DATABASE_URL: url,
  ADMIN_NOMBRE: "Adela",
  ADMIN_USUARIO: "adela",
  ADMIN_CONTRASENA: "contrasena-de-prueba",
  ADMIN_PIN: "2468",
  SESION_MINUTOS_INACTIVIDAD: "15",
};

export default defineConfig({
  testDir: "tests",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/preparar.ts",
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    // Pantalla del TPV: 15,6 pulgadas en horizontal.
    viewport: { width: 1366, height: 768 },
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "tpv",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 768 },
        hasTouch: true,
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
      },
    },
  ],
  webServer: {
    command: `pnpm --filter @adela/web build && pnpm --filter @adela/web start -p ${PUERTO}`,
    port: PUERTO,
    timeout: 180_000,
    reuseExistingServer: false,
    env: ENTORNO_PRUEBAS,
  },
});
