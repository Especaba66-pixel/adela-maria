import { expect, test, type Page } from "@playwright/test";

/**
 * Desde el móvil: se registra el teléfono como equipo de confianza, se navega con el menú del móvil y ninguna pantalla
 * se sale por los lados (todo se lee sin desplazar la página en horizontal).
 */
test.describe.configure({ mode: "serial" });

let pagina: Page;

test.beforeAll(async ({ browser }) => {
  pagina = await browser.newPage();
});
test.afterAll(async () => pagina.close());

/** Ancho de la página frente al de la pantalla (lo que sobresale obliga a desplazar en horizontal). */
const sobresale = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const PANTALLAS = [
  "/gestion",
  "/gestion/agenda",
  "/gestion/agenda?vista=semana",
  "/gestion/agenda?vista=mes",
  "/gestion/agenda/nueva",
  "/gestion/clientas",
  "/gestion/tpv",
  "/gestion/caja",
  "/gestion/avisos",
  "/gestion/reservas",
  "/gestion/mas",
  "/gestion/mas/tratamientos",
  "/gestion/mas/facturacion",
  "/gestion/mas/bonos",
  "/gestion/mas/stock",
  "/gestion/mas/proveedores",
  "/gestion/mas/gastos",
  "/gestion/mas/whatsapp",
  "/gestion/mas/informes",
  "/gestion/mas/configuracion",
  "/gestion/mas/configuracion/horario",
  "/gestion/mas/configuracion/profesionales",
  "/gestion/mas/configuracion/actividad",
];

test("se registra el móvil y se entra", async () => {
  await pagina.goto("/gestion");
  await expect(pagina).toHaveURL(/registrar-equipo/);
  expect(await sobresale(pagina)).toBeLessThanOrEqual(0);
  await pagina.getByLabel("Correo").fill("adelamaria_16@hotmail.com");
  await pagina.getByLabel("Contraseña").fill("contrasena-de-prueba");
  await pagina.getByRole("button", { name: "Registrar este equipo" }).click();
  await expect(pagina.getByRole("button", { name: "Menú" })).toBeVisible();
});

test("el menú del móvil lleva a cada sitio", async () => {
  await pagina.getByRole("button", { name: "Menú" }).click();
  await pagina.getByRole("navigation", { name: "Menú principal" }).getByRole("link", { name: "Clientas" }).click();
  await expect(pagina.getByRole("heading", { name: "Clientas", level: 1 })).toBeVisible();
  await expect(pagina.getByRole("navigation", { name: "Menú principal" })).toBeHidden();
});

test("se puede instalar como app (manifiesto e icono)", async () => {
  const r = await pagina.request.get("/manifest.webmanifest");
  expect(r.status()).toBe(200);
  expect(await r.json()).toMatchObject({ start_url: "/gestion", display: "standalone" });
  expect((await pagina.request.get("/app-512.png")).status()).toBe(200);
});

test("todas las pantallas caben en el móvil", async () => {
  for (const ruta of PANTALLAS) {
    await pagina.goto(ruta);
    await expect(pagina.getByRole("heading", { level: 1 }).first()).toBeVisible();
    // Con CAPTURAS=<carpeta> se guardan capturas para revisarlas a ojo.
    if (process.env.CAPTURAS) await pagina.screenshot({ path: `${process.env.CAPTURAS}/${ruta.replace(/[^a-z]+/g, "-")}.png`, fullPage: true });
    expect.soft(await sobresale(pagina), `${ruta} sobresale`).toBeLessThanOrEqual(0);
  }
});

test("en el TPV del móvil, una barra lleva a la cuenta", async () => {
  await pagina.goto("/gestion/tpv");
  await pagina.getByRole("region", { name: "Tratamientos" }).getByRole("button", { name: /^Axilas/ }).click();
  await pagina.getByRole("link", { name: /Ver la cuenta/ }).click();
  await expect(pagina.getByRole("region", { name: "Cuenta" }).getByText("Axilas")).toBeInViewport();
});
