import { expect, test, type Page } from "@playwright/test";
import { alerta, diaMadrid, registrarTpv } from "./ayudas";

/**
 * Parte de las clientas: ven los tratamientos y piden cita sin registrarse ni claves.
 * El centro ve la petición, escribe por WhatsApp y la confirma.
 */
test.describe.configure({ mode: "serial" });

async function rellenarCita(page: Page, datos: { nombre: string; telefono: string; dia?: string }) {
  await page.getByLabel("¿Qué día te viene bien?").fill(datos.dia ?? diaMadrid(2));
  await page.getByText("Por la tarde").click();
  await page.getByLabel("Tu nombre", { exact: true }).fill(datos.nombre);
  await page.getByLabel(/Tu teléfono/).fill(datos.telefono);
  await page.getByRole("checkbox").check();
}

test.describe("clienta", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("ve los tratamientos y los bonos sin entrar con ninguna clave", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Tratamientos" })).toBeVisible();
    await expect(page.getByText("Verse limpia y purificada (higiene facial)")).toBeVisible();
    await expect(page.getByText("90 min · 30,00 €")).toBeVisible();
    await expect(page.getByText("Bono facial 6 sesiones")).toBeVisible();
    // Servicio nuevo sin precio todavía: se ve y se puede pedir.
    const cejas = page.getByRole("listitem").filter({ hasText: "Diseño de cejas" });
    await expect(cejas).toContainText("Precio a consultar");
    await expect(cejas.getByRole("link", { name: "Pedir cita: Diseño de cejas" })).toBeVisible();
    await expect(page.getByLabel(/contraseña|PIN/i)).toHaveCount(0);
  });

  test("pide cita desde un tratamiento, en el móvil", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Pedir cita: Verse limpia y purificada (higiene facial)" }).click();
    await expect(page.getByLabel("Tratamiento").locator("option:checked")).toHaveText("Verse limpia y purificada (higiene facial)");
    await page.getByLabel("Comentario").fill("Tengo la piel sensible");
    await rellenarCita(page, { nombre: "Marta López", telefono: "600 11 22 33" });
    await page.getByRole("button", { name: "Pedir cita" }).click();
    await expect(page.getByRole("heading", { name: "¡Petición recibida!" })).toBeVisible();
    await expect(page.getByText("Tu cita no está confirmada hasta que te contestemos")).toBeVisible();
  });

  test("se puede pedir cita de diseño de cejas aunque aún no tenga precio", async ({ page }) => {
    await page.goto("/reservar");
    await page.getByLabel("Tratamiento").selectOption({ label: "Diseño de cejas" });
    await rellenarCita(page, { nombre: "Carmen", telefono: "622 33 44 55" });
    await page.getByRole("button", { name: "Pedir cita" }).click();
    await expect(page.getByRole("heading", { name: "¡Petición recibida!" })).toBeVisible();
  });

  test("avisa si el teléfono no es válido", async ({ page }) => {
    await page.goto("/reservar");
    await page.getByLabel("Tratamiento").selectOption({ label: "Labio, mentón o patilla" });
    await rellenarCita(page, { nombre: "Ana", telefono: "12345" });
    await page.getByRole("button", { name: "Pedir cita" }).click();
    await expect(alerta(page)).toHaveText(/Revisa el teléfono/);
  });

  test("un mismo teléfono no puede acumular más de 3 peticiones sin contestar", async ({ page }) => {
    for (let i = 1; i <= 4; i++) {
      await page.goto("/reservar");
      await page.getByLabel("Tratamiento").selectOption({ label: "Labio, mentón o patilla" });
      await rellenarCita(page, { nombre: `Prueba ${i}`, telefono: "699 00 00 00" });
      await page.getByRole("button", { name: "Pedir cita" }).click();
      if (i <= 3) await expect(page.getByRole("heading", { name: "¡Petición recibida!" })).toBeVisible();
    }
    await expect(alerta(page)).toHaveText(/varias peticiones pendientes/);
  });

  test("los programas automáticos que rellenan el campo trampa no crean peticiones", async ({ page }) => {
    await page.goto("/reservar");
    await page.getByLabel("Tratamiento").selectOption({ label: "Labio, mentón o patilla" });
    await rellenarCita(page, { nombre: "Robot", telefono: "611 22 33 44" });
    await page.locator('input[name="web"]').fill("http://spam.example", { force: true });
    await page.getByRole("button", { name: "Pedir cita" }).click();
    await expect(page.getByRole("heading", { name: "¡Petición recibida!" })).toBeVisible();
  });
});

test.describe("centro", () => {
  test("ve las peticiones, escribe por WhatsApp y confirma", async ({ page }) => {
    await registrarTpv(page);
    // Marta, Carmen y 3 de prueba. Ni la cuarta rechazada ni la del robot.
    await expect(page.getByTestId("tarjeta-Reservas por confirmar")).toHaveText("5");
    await page.getByRole("link", { name: /Reservas por confirmar/ }).click();
    await expect(page.getByRole("region", { name: /Robot/ })).toHaveCount(0);

    const marta = page.getByRole("region", { name: "Petición de Marta López" });
    await expect(marta).toContainText("Verse limpia y purificada (higiene facial)");
    await expect(marta).toContainText("por la tarde");
    await expect(marta).toContainText("600 11 22 33");
    await expect(marta).toContainText("Tengo la piel sensible");
    await expect(marta.getByRole("link", { name: "Escribir por WhatsApp" })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/34600112233\?text=Hola%2C%20Marta%20L%C3%B3pez/,
    );

    await marta.getByRole("button", { name: "Confirmar" }).click();
    await expect(marta).toHaveCount(0);
    const contestada = (quien: string, estado: string) =>
      page.locator("div").filter({ hasText: quien }).filter({ hasText: estado }).last();
    await expect(contestada("Marta López · Verse limpia y purificada (higiene facial)", "Confirmada por Adela")).toBeVisible();

    await page.getByRole("region", { name: "Petición de Prueba 1" }).getByRole("button", { name: "Rechazar" }).click();
    await expect(contestada("Prueba 1 · Labio, mentón o patilla", "Rechazada por Adela")).toBeVisible();

    await page.goto("/gestion");
    await expect(page.getByTestId("tarjeta-Reservas por confirmar")).toHaveText("3");
  });
});
