import { expect, test, type Page } from "@playwright/test";
import { alerta, registrarTpv, teclearPin } from "./ayudas";

/**
 * Parte del centro: la administración registra el TPV con su contraseña (una sola vez) y a partir de ahí
 * el personal entra solo con PIN. Permisos, bloqueo y registro de actividad.
 */
test.describe.configure({ mode: "serial" });

let pagina: Page;
test.beforeAll(async ({ browser }) => {
  pagina = await browser.newPage();
});
test.afterAll(async () => pagina.close());

test("en un equipo sin registrar no se puede entrar con PIN", async () => {
  await pagina.goto("/gestion");
  await expect(pagina).toHaveURL(/\/gestion\/registrar-equipo$/);
  await pagina.goto("/gestion/pin");
  await expect(pagina).toHaveURL(/\/gestion\/registrar-equipo$/);
});

test("rechaza una contraseña incorrecta sin decir si el usuario existe", async () => {
  await pagina.getByLabel("Usuario de administración").fill("adela");
  await pagina.getByLabel("Contraseña").fill("no-es-esta-contrasena");
  await pagina.getByRole("button", { name: "Registrar este equipo" }).click();
  await expect(alerta(pagina)).toHaveText("Usuario o contraseña incorrectos.");
});

test("la administradora registra este equipo como TPV y entra", async () => {
  await registrarTpv(pagina);
  await expect(pagina.getByRole("heading", { level: 1 })).toHaveText(/^(Buenos días|Buenas tardes|Buenas noches), Adela$/);
  await expect(alerta(pagina).filter({ hasText: "copia de seguridad" })).toBeVisible();
  await expect(pagina.getByTestId("tarjeta-Reservas por confirmar")).toHaveText("0");
  await expect(pagina.getByText("Falta el precio o la duración de: Diseño de cejas.")).toBeVisible();
});

test("el menú tiene las 7 entradas fijas, con botones de al menos 64 px de alto", async () => {
  const menu = pagina.getByRole("navigation", { name: "Menú principal" }).getByRole("link");
  await expect(menu).toHaveText(["Inicio", "Agenda", "Clientas", "TPV", "Caja", "Avisos", "Más"].map((t) => new RegExp(t)));
  for (const enlace of await menu.all()) expect((await enlace.boundingBox())!.height).toBeGreaterThanOrEqual(64);
});

test("las tarifas muestran los tratamientos y los dos bonos faciales", async () => {
  await pagina.goto("/gestion/mas/tratamientos");
  await expect(pagina.getByText("Higiene facial")).toBeVisible();
  await expect(pagina.getByText("Bono facial 3 sesiones")).toBeVisible();
  await expect(pagina.getByText("120,00 €")).toBeVisible();
  await expect(pagina.getByText("240,00 €")).toBeVisible();
  await expect(pagina.getByText("Diseño de cejas")).toBeVisible();
  await expect(pagina.getByText("Precio a consultar")).toBeVisible();
});

const formularioNuevo = () => pagina.locator("form").filter({ has: pagina.getByRole("button", { name: "Crear usuario" }) });

test("da de alta a Lucía en recepción solo con PIN, sin contraseña", async () => {
  await pagina.goto("/gestion/mas/configuracion/usuarios");
  const form = formularioNuevo();
  await form.getByLabel("Nombre").fill("Lucía");
  await form.getByLabel("Usuario").fill("lucia");
  await form.getByLabel("Rol").selectOption("recepcion");
  await form.getByLabel(/PIN/).fill("3579");
  await form.getByRole("button", { name: "Crear usuario" }).click();
  await expect(pagina.getByText("Lucía ya puede entrar.")).toBeVisible();
  await expect(pagina.getByRole("region", { name: "Lucía" })).toBeVisible();
});

test("no deja crear un PIN trivial", async () => {
  const form = formularioNuevo();
  await form.getByLabel("Nombre").fill("Prueba");
  await form.getByLabel("Usuario").fill("prueba");
  await form.getByLabel("Rol").selectOption("profesional");
  await form.getByLabel(/PIN/).fill("1234");
  await form.getByRole("button", { name: "Crear usuario" }).click();
  await expect(alerta(pagina)).toHaveText("Ese PIN es demasiado fácil de adivinar.");
});

test("no deja crear otra administradora sin contraseña", async () => {
  const form = formularioNuevo();
  await form.getByLabel("Nombre").fill("Otra");
  await form.getByLabel("Usuario").fill("otra");
  await form.getByLabel("Rol").selectOption("administrador");
  await form.getByLabel(/PIN/).fill("8024");
  await form.getByRole("button", { name: "Crear usuario" }).click();
  await expect(alerta(pagina)).toHaveText(/al menos 10 caracteres/);
});

test("cambiar de persona lleva al PIN; un PIN incorrecto no entra", async () => {
  await pagina.getByRole("button", { name: "Cambiar de persona" }).click();
  await expect(pagina).toHaveURL(/\/gestion\/pin$/);
  await pagina.getByRole("button", { name: "Lucía" }).click();
  await teclearPin(pagina, "9999");
  await expect(alerta(pagina)).toHaveText("PIN incorrecto.");
});

test("Lucía entra con su PIN; ve las reservas pero no la configuración", async () => {
  await teclearPin(pagina, "3579");
  await expect(pagina.getByTestId("usuario-actual")).toHaveText("Lucía");
  await expect(pagina.getByText("Recepción")).toBeVisible();
  await expect(pagina.getByTestId("tarjeta-Reservas por confirmar")).toBeVisible();
  await pagina.getByRole("link", { name: /Más/ }).click();
  await expect(pagina.getByText("Reservas web")).toBeVisible();
  await expect(pagina.getByText("Configuración")).toHaveCount(0);
  await pagina.goto("/gestion/mas/configuracion/usuarios");
  await expect(pagina).toHaveURL(/\/gestion\/sin-permiso$/);
});

test("cinco PIN incorrectos bloquean temporalmente a la persona", async () => {
  await pagina.goto("/gestion");
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
  await pagina.goto("/gestion/mas/configuracion/actividad");
  const tabla = pagina.getByRole("table");
  await expect(tabla.getByRole("row").filter({ hasText: "Bloqueado por intentos fallidos" })).toHaveCount(1);
  await expect(tabla.getByRole("row").filter({ hasText: "Registró un equipo de confianza" })).toHaveCount(1);
  await expect(tabla.getByRole("row").filter({ hasText: "Creó un usuario" })).toHaveCount(2);
  await expect(tabla.getByRole("row").filter({ hasText: "Intento de entrada fallido" }).first()).toBeVisible();
  await expect(tabla).not.toContainText("scrypt");
});

test("no se puede quitar la administración a la única administradora", async () => {
  await pagina.goto("/gestion/mas/configuracion/usuarios");
  const adela = pagina.getByRole("region", { name: "Adela" });
  await adela.getByText("Editar").click();
  await adela.getByLabel("Rol").selectOption("recepcion");
  await adela.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(adela.locator('[role="alert"]')).toHaveText("Tiene que quedar al menos una persona con administración.");
});

test("el personal sin administración no puede registrar equipos", async ({ browser }) => {
  const otra = await browser.newPage();
  await otra.goto("/gestion/registrar-equipo");
  await otra.getByLabel("Usuario de administración").fill("lucia");
  await otra.getByLabel("Contraseña").fill("cualquier-cosa-larga");
  await otra.getByRole("button", { name: "Registrar este equipo" }).click();
  await expect(alerta(otra)).toHaveText("Usuario o contraseña incorrectos.");
  await otra.close();
});

test("la administración pone el teléfono y la dirección, y la web de clientas los muestra", async () => {
  await pagina.goto("/gestion/mas/configuracion/centro");
  await pagina.getByLabel(/Teléfono y WhatsApp/).fill("12345");
  await pagina.getByRole("button", { name: "Guardar" }).click();
  await expect(alerta(pagina)).toHaveText(/Revisa el teléfono/);

  await pagina.getByLabel(/Teléfono y WhatsApp/).fill("600 99 88 77");
  await pagina.getByLabel("Dirección").fill("Calle Mayor 1, Alicante");
  await pagina.getByRole("button", { name: "Guardar" }).click();
  await expect(pagina.getByText("Guardado. Ya se ve en la web de clientas.")).toBeVisible();

  await pagina.goto("/");
  const pie = pagina.getByRole("contentinfo");
  await expect(pie).toContainText("Calle Mayor 1, Alicante");
  await expect(pie.getByRole("link", { name: "Llamar al 600 99 88 77" })).toHaveAttribute("href", "tel:+34600998877");
  await expect(pie.getByRole("link", { name: "Escríbenos por WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/34600998877\?/);
});
