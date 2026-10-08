import { expect, test, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { ENTORNO_PRUEBAS } from "../playwright.config";
import { alerta, registrarTpv } from "./ayudas";

/**
 * Parte de las clientas: ven los tratamientos y reservan una hora libre sin registrarse ni claves.
 * Los tratamientos sin duración se piden sin hora. El centro confirma, rechaza o da cita.
 */
test.describe.configure({ mode: "serial" });

// Horario de Adela para estas pruebas: todos los días de 9 a 14 y de 16 a 21.
test.beforeAll(() => {
  const sql = `
    delete from horarios where profesional_id = (select id from profesionales where nombre = 'Adela');
    insert into horarios (profesional_id, dia_semana, inicio_min, fin_min)
    select p.id, d, t.i, t.f from profesionales p, generate_series(1, 7) d, (values (540, 840), (960, 1260)) t(i, f)
    where p.nombre = 'Adela';`;
  execSync(`psql "${ENTORNO_PRUEBAS.DATABASE_URL}" -q -v ON_ERROR_STOP=1`, { input: sql });
});

const HIGIENE = "Verse limpia y purificada (higiene facial)";
const enDias = (n: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(Date.now() + n * 86_400_000);

async function pedirSinHora(page: Page, datos: { nombre: string; telefono: string }) {
  await page.goto("/reservar");
  await page.getByLabel("Tratamiento").selectOption({ label: "Diseño de cejas" });
  await page.getByRole("button", { name: "Ver horas" }).click();
  await expect(page.getByRole("heading", { name: /Déjanos tu petición/ })).toBeVisible();
  await page.getByLabel("¿Qué día te viene bien?").fill(enDias(3));
  await page.getByText("Por la tarde").click();
  await page.getByLabel("Tu nombre", { exact: true }).fill(datos.nombre);
  await page.getByLabel(/Tu teléfono/).fill(datos.telefono);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Pedir cita" }).click();
}

let horaReservada = "";

test.describe("clienta en el móvil", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("ve los tratamientos y los bonos sin entrar con ninguna clave", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Tratamientos" })).toBeVisible();
    await expect(page.getByText(HIGIENE)).toBeVisible();
    await expect(page.getByText("90 min · 30,00 €")).toBeVisible();
    await expect(page.getByText("Bono facial 6 sesiones")).toBeVisible();
    const cejas = page.getByRole("listitem").filter({ hasText: "Diseño de cejas" });
    await expect(cejas).toContainText("Precio a consultar");
    await expect(page.getByLabel(/contraseña|PIN/i)).toHaveCount(0);
  });

  test("reserva una hora libre: tratamiento, día, hora y datos", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: `Pedir cita: ${HIGIENE}` }).click();
    await expect(page.getByLabel("Tratamiento").locator("option:checked")).toHaveText(HIGIENE);
    await page.getByRole("region", { name: /¿Qué día\?/ }).getByRole("link").first().click();
    const hora = page.getByRole("region", { name: /¿A qué hora\?/ }).getByRole("link").first();
    horaReservada = (await hora.textContent())!;
    await hora.click();
    await expect(page.getByText(`a las ${horaReservada}`)).toBeVisible();
    await page.getByLabel("Tu nombre", { exact: true }).fill("Marta López");
    await page.getByLabel(/Tu teléfono/).fill("600 11 22 33");
    await page.getByLabel("Comentario").fill("Tengo la piel sensible");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Reservar esta hora" }).click();
    await expect(page.getByRole("heading", { name: "¡Hora reservada!" })).toBeVisible();
  });

  test("esa hora ya no se ofrece a nadie más", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: `Pedir cita: ${HIGIENE}` }).click();
    await page.getByRole("region", { name: /¿Qué día\?/ }).getByRole("link").first().click();
    await expect(page.getByRole("region", { name: /¿A qué hora\?/ }).getByRole("link", { name: horaReservada, exact: true })).toHaveCount(0);
  });

  test("avisa si el teléfono no es válido", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Pedir cita: Axilas" }).click();
    await page.getByRole("region", { name: /¿Qué día\?/ }).getByRole("link").first().click();
    await page.getByRole("region", { name: /¿A qué hora\?/ }).getByRole("link").first().click();
    await page.getByLabel("Tu nombre", { exact: true }).fill("Ana");
    await page.getByLabel(/Tu teléfono/).fill("12345");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Reservar esta hora" }).click();
    await expect(alerta(page)).toHaveText(/Revisa el teléfono/);
  });

  test("un tratamiento sin duración se pide sin hora", async ({ page }) => {
    await pedirSinHora(page, { nombre: "Lola Pérez", telefono: "622 33 44 55" });
    await expect(page.getByRole("heading", { name: "¡Petición recibida!" })).toBeVisible();
  });

  test("un mismo teléfono no puede acumular más de 3 peticiones sin contestar", async ({ page }) => {
    for (let i = 1; i <= 3; i++) {
      await pedirSinHora(page, { nombre: `Prueba ${i}`, telefono: "699 00 00 00" });
      await expect(page.getByRole("heading", { name: "¡Petición recibida!" })).toBeVisible();
    }
    await pedirSinHora(page, { nombre: "Prueba 4", telefono: "699 00 00 00" });
    await expect(alerta(page)).toHaveText(/varias peticiones pendientes/);
  });

  test("los programas automáticos que rellenan el campo trampa no crean nada", async ({ page }) => {
    await page.goto("/reservar");
    await page.getByLabel("Tratamiento").selectOption({ label: "Diseño de cejas" });
    await page.getByRole("button", { name: "Ver horas" }).click();
    await page.getByLabel("¿Qué día te viene bien?").fill(enDias(1));
    await page.getByLabel("Tu nombre", { exact: true }).fill("Robot");
    await page.getByLabel(/Tu teléfono/).fill("611 99 99 99");
    await page.getByRole("checkbox").check();
    await page.locator('input[name="web"]').fill("http://spam.example", { force: true });
    await page.getByRole("button", { name: "Pedir cita" }).click();
    await expect(page.getByRole("heading", { name: "¡Petición recibida!" })).toBeVisible();
  });
});

test.describe("centro", () => {
  let pagina: Page;
  test.beforeAll(async ({ browser }) => {
    pagina = await browser.newPage();
    await registrarTpv(pagina);
  });
  test.afterAll(async () => pagina.close());

  test("ve la cita web, escribe por WhatsApp y la confirma", async () => {
    // La cita de Marta, la petición de Lola y las 3 de prueba. Ni la cuarta ni la del robot.
    await expect(pagina.getByTestId("tarjeta-Reservas por confirmar")).toHaveText("5");
    await pagina.getByRole("link", { name: /Reservas por confirmar/ }).click();
    await expect(pagina.getByRole("region", { name: /Robot/ })).toHaveCount(0);

    const marta = pagina.getByRole("region", { name: "Cita web de Marta López" });
    await expect(marta).toContainText(HIGIENE);
    await expect(marta).toContainText(`a las ${horaReservada}`);
    await expect(marta).toContainText("Tengo la piel sensible");
    await expect(marta.getByRole("link", { name: "Escribir por WhatsApp" })).toHaveAttribute(
      "href",
      new RegExp(`^https://wa\\.me/34600112233\\?text=.*${encodeURIComponent(`a las ${horaReservada}`)}`),
    );
    await marta.getByRole("button", { name: "Confirmar" }).click();
    await expect(marta).toHaveCount(0);

    await pagina.goto("/gestion");
    await expect(pagina.getByTestId("tarjeta-Reservas por confirmar")).toHaveText("4");
  });

  test("Marta tiene ficha creada desde la web, con su permiso de privacidad", async () => {
    await pagina.goto("/gestion/clientas?q=Marta");
    await pagina.getByRole("link", { name: /Marta López/ }).click();
    await expect(pagina.getByText(/Aceptó la privacidad al reservar: sí \(web\)/)).toBeVisible();
    await expect(pagina.getByText(/· Confirmada/).first()).toBeVisible();
  });

  test("para dar cita a un tratamiento sin duración, antes hay que ponérsela", async () => {
    await pagina.goto("/gestion/reservas");
    await pagina.getByRole("region", { name: "Petición de Lola Pérez" }).getByRole("link", { name: "Dar cita" }).click();
    await expect(pagina.getByLabel("Nombre")).toHaveValue("Lola Pérez");
    await pagina.getByLabel("Hora").fill("10:00");
    await pagina.getByRole("button", { name: "Guardar cita" }).click();
    await expect(alerta(pagina)).toHaveText("Falta la duración de: Diseño de cejas. Ponla en Tratamientos.");
  });

  test("la administración pone precio y duración al diseño de cejas, y la web lo muestra", async ({ browser }) => {
    await pagina.goto("/gestion/mas/tratamientos");
    await pagina.getByLabel("Editar Diseño de cejas").click();
    const form = pagina.locator("form").filter({ has: pagina.locator('input[name="nombre"][value="Diseño de cejas"]') });
    await form.getByLabel("Minutos").fill("20");
    await form.getByLabel("Precio (€)").fill("12");
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(pagina.getByText("Tratamiento guardado.")).toBeVisible();

    const movil = await browser.newPage();
    await movil.goto("/");
    await expect(movil.getByRole("listitem").filter({ hasText: "Diseño de cejas" })).toContainText("20 min · 12,00 €");
    await movil.close();
  });

  test("ahora sí: da cita a Lola y su petición queda contestada", async () => {
    await pagina.goto("/gestion/reservas");
    await pagina.getByRole("region", { name: "Petición de Lola Pérez" }).getByRole("link", { name: "Dar cita" }).click();
    await pagina.getByLabel("Hora").fill("10:00");
    await pagina.getByRole("button", { name: "Guardar cita" }).click();
    await expect(pagina.getByText("Cita guardada.")).toBeVisible();
    await expect(pagina.getByRole("heading", { level: 1 })).toContainText("10:00–10:20");
    await pagina.goto("/gestion/reservas");
    await expect(pagina.getByRole("region", { name: "Petición de Lola Pérez" })).toHaveCount(0);
  });

  test("rechazar una petición sin hora", async () => {
    await pagina.getByRole("region", { name: "Petición de Prueba 1" }).getByRole("button", { name: "Rechazar" }).click();
    await expect(pagina.locator("div").filter({ hasText: "Prueba 1 · Diseño de cejas" }).filter({ hasText: "Rechazada por Adela" }).last()).toBeVisible();
  });
});
