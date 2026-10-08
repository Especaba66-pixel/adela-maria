import { expect, test, type Page } from "@playwright/test";

/**
 * Recorrido de la fase 0: entrar con usuario y contraseña, registrar el TPV, crear una persona
 * de recepción, cambiar de persona con PIN y comprobar permisos y registro de actividad.
 */
test.describe.configure({ mode: "serial" });

let pagina: Page;
test.beforeAll(async ({ browser }) => {
  pagina = await browser.newPage();
});
test.afterAll(async () => pagina.close());

/** Los avisos de la app (Next.js añade otro role="alert" vacío para anunciar los cambios de página). */
const alerta = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

async function teclearPin(page: Page, pin: string) {
  for (const cifra of pin) await page.getByRole("button", { name: cifra, exact: true }).click();
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test("sin sesión lleva a la pantalla de entrada; el PIN no está disponible en un equipo sin registrar", async () => {
  await pagina.goto("/");
  await expect(pagina).toHaveURL(/\/entrar$/);
  await pagina.goto("/pin");
  await expect(pagina).toHaveURL(/\/entrar$/);
});

test("rechaza una contraseña incorrecta sin decir si el usuario existe", async () => {
  await pagina.getByLabel("Usuario").fill("adela");
  await pagina.getByLabel("Contraseña").fill("no-es-esta-contrasena");
  await pagina.getByRole("button", { name: "Entrar" }).click();
  await expect(alerta(pagina)).toHaveText("Usuario o contraseña incorrectos.");
});

test("la administradora entra con contraseña y registra este equipo como TPV", async () => {
  await pagina.getByLabel("Usuario").fill("Adela");
  await pagina.getByLabel("Contraseña").fill("contrasena-de-prueba");
  await pagina.getByLabel(/Este equipo es el TPV/).check();
  await pagina.getByRole("button", { name: "Entrar" }).click();
  await expect(pagina.getByRole("heading", { level: 1 })).toHaveText(/^(Buenos días|Buenas tardes|Buenas noches), Adela$/);
  await expect(pagina.getByTestId("usuario-actual")).toHaveText("Adela");
  // Aún no hay copias ni tratamientos: el inicio lo avisa.
  await expect(alerta(pagina).filter({ hasText: "copia de seguridad" })).toBeVisible();
  await expect(pagina.getByText("Faltan por cargar los tratamientos")).toBeVisible();
});

test("el menú tiene las 7 entradas fijas, con botones de al menos 64 px de alto", async () => {
  const menu = pagina.getByRole("navigation", { name: "Menú principal" }).getByRole("link");
  await expect(menu).toHaveText(["Inicio", "Agenda", "Clientas", "TPV", "Caja", "Avisos", "Más"].map((t) => new RegExp(t)));
  for (const enlace of await menu.all()) expect((await enlace.boundingBox())!.height).toBeGreaterThanOrEqual(64);
});

test("las tarifas muestran los dos bonos faciales", async () => {
  await pagina.goto("/mas/tratamientos");
  await expect(pagina.getByText("Bono facial 3 sesiones")).toBeVisible();
  await expect(pagina.getByText("120,00 €")).toBeVisible();
  await expect(pagina.getByText("Bono facial 6 sesiones")).toBeVisible();
  await expect(pagina.getByText("240,00 €")).toBeVisible();
});

test("la administradora da de alta a Lucía en recepción", async () => {
  await pagina.goto("/mas/configuracion/usuarios");
  const form = pagina.locator("form").filter({ has: pagina.getByRole("button", { name: "Crear usuario" }) });
  await form.getByLabel("Nombre").fill("Lucía");
  await form.getByLabel("Usuario").fill("lucia");
  await form.getByLabel("Rol").selectOption("recepcion");
  await form.getByLabel(/PIN/).fill("3579");
  await form.getByLabel(/Contraseña/).fill("lucia-contrasena-1");
  await form.getByRole("button", { name: "Crear usuario" }).click();
  await expect(pagina.getByText("Lucía ya puede entrar.")).toBeVisible();
  await expect(pagina.getByRole("heading", { name: "Lucía" })).toBeVisible();
});

test("no deja crear un PIN trivial", async () => {
  const form = pagina.locator("form").filter({ has: pagina.getByRole("button", { name: "Crear usuario" }) });
  await form.getByLabel("Nombre").fill("Prueba");
  await form.getByLabel("Usuario").fill("prueba");
  await form.getByLabel("Rol").selectOption("profesional");
  await form.getByLabel(/PIN/).fill("1234");
  await form.getByLabel(/Contraseña/).fill("prueba-contrasena");
  await form.getByRole("button", { name: "Crear usuario" }).click();
  await expect(alerta(pagina)).toHaveText("Ese PIN es demasiado fácil de adivinar.");
});

test("cambiar de persona lleva al PIN; un PIN incorrecto no entra", async () => {
  await pagina.getByRole("button", { name: "Cambiar de persona" }).click();
  await expect(pagina).toHaveURL(/\/pin$/);
  await pagina.getByRole("button", { name: "Lucía" }).click();
  await teclearPin(pagina, "9999");
  await expect(alerta(pagina)).toHaveText("PIN incorrecto.");
});

test("Lucía entra con su PIN y no ve la configuración", async () => {
  await teclearPin(pagina, "3579");
  await expect(pagina.getByTestId("usuario-actual")).toHaveText("Lucía");
  await expect(pagina.getByText("Recepción")).toBeVisible();
  // Recepción no recibe los avisos del sistema.
  await expect(pagina.getByText("Todo en orden.")).toBeVisible();
  await pagina.getByRole("link", { name: /Más/ }).click();
  await expect(pagina.getByText("Tratamientos")).toBeVisible();
  await expect(pagina.getByText("Configuración")).toHaveCount(0);
  await pagina.goto("/mas/configuracion/usuarios");
  await expect(pagina).toHaveURL(/\/sin-permiso$/);
});

test("cinco PIN incorrectos bloquean temporalmente a la persona", async () => {
  await pagina.goto("/");
  await pagina.getByRole("button", { name: "Cambiar de persona" }).click();
  await pagina.getByRole("button", { name: "Lucía" }).click();
  for (let i = 1; i <= 4; i++) {
    await teclearPin(pagina, "8642");
    await expect(alerta(pagina)).toHaveText("PIN incorrecto.");
  }
  await teclearPin(pagina, "8642");
  await expect(alerta(pagina)).toHaveText("Demasiados intentos. Prueba de nuevo en 5 minutos.");
  await teclearPin(pagina, "3579");
  await expect(alerta(pagina)).toHaveText(/Demasiados intentos/);
});

test("el registro de actividad recoge todo lo anterior", async () => {
  await pagina.getByRole("button", { name: "No soy Lucía" }).click();
  await pagina.getByRole("button", { name: "Adela" }).click();
  await teclearPin(pagina, "2468");
  await expect(pagina.getByTestId("usuario-actual")).toHaveText("Adela");
  await pagina.goto("/mas/configuracion/actividad");
  const tabla = pagina.getByRole("table");
  await expect(tabla.getByRole("row").filter({ hasText: "Bloqueado por intentos fallidos" })).toHaveCount(1);
  await expect(tabla.getByRole("row").filter({ hasText: "Registró un equipo de confianza" })).toHaveCount(1);
  await expect(tabla.getByRole("row").filter({ hasText: "Creó un usuario" })).toHaveCount(2);
  await expect(tabla.getByRole("row").filter({ hasText: "Intento de entrada fallido" }).first()).toBeVisible();
  await expect(tabla).not.toContainText("scrypt");
});

test("no se puede quitar la administración a la única administradora", async () => {
  await pagina.goto("/mas/configuracion/usuarios");
  const adela = pagina.getByRole("region", { name: "Adela" });
  await adela.getByText("Editar").click();
  await adela.getByLabel("Rol").selectOption("recepcion");
  await adela.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(adela.locator('[role="alert"]')).toHaveText("Tiene que quedar al menos una persona con administración.");
});
