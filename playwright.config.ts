import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

config({ quiet: true });
const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("Falta DATABASE_URL_TEST en .env");

const PUERTO = 3100;
/** Servicio de reservas por internet (Cloudflare en local) y landing que lo usa. */
export const RESERVAS = { url: "http://127.0.0.1:8788", clave: "clave-de-pruebas-0123456789abcdef0123456789", landing: "http://127.0.0.1:8090" };
/** WhatsApp de Meta imitado en local (tests/meta-falso.mjs) y secreto con el que firma sus avisos. */
export const META = { url: "http://127.0.0.1:8099", secreto: "secreto-de-pruebas" };
export const ENTORNO_PRUEBAS = {
  DATABASE_URL: url,
  ADMIN_NOMBRE: "Adela",
  ADMIN_USUARIO: "adela",
  ADMIN_CONTRASENA: "contrasena-de-prueba",
  ADMIN_PIN: "2468",
  SESION_MINUTOS_INACTIVIDAD: "15",
  PORT: String(PUERTO),
  RESERVAS_URL: RESERVAS.url,
  RESERVAS_CLAVE: RESERVAS.clave,
  // En las pruebas se sincroniza a mano («Sincronizar ahora»).
  RESERVAS_CADA_SEGUNDOS: "3600",
  WHATSAPP_TOKEN: "token-de-pruebas",
  WHATSAPP_NUMERO_ID: "123456",
  WHATSAPP_API_URL: `${META.url}/v23.0`,
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
  webServer: [
    {
      command: `pnpm --filter @adela/web build && pnpm --filter @adela/web start -p ${PUERTO}`,
      port: PUERTO,
      timeout: 180_000,
      reuseExistingServer: false,
      env: ENTORNO_PRUEBAS,
    },
    { command: "pnpm --filter @adela/reservas pruebas", url: `${RESERVAS.url}/api/servicios`, timeout: 120_000, reuseExistingServer: false },
    {
      command: `pnpm --filter @adela/landing build && node tests/servidor-estatico.mjs 8090`,
      url: RESERVAS.landing,
      timeout: 60_000,
      reuseExistingServer: false,
      env: { RESERVAS_URL: RESERVAS.url },
    },
    { command: "node tests/meta-falso.mjs 8099", url: META.url, timeout: 10_000, reuseExistingServer: false },
  ],
});
