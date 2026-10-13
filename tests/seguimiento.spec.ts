import { expect, test, type Page } from "@playwright/test";
import { diaMadrid, registrarTpv } from "./ayudas";

/**
 * Fase 5: el inicio dice qué hay que hacer hoy; cada aviso trae su WhatsApp ya escrito (se anota en la ficha y no se
 * envía nada solo), se marca hecho o se deja para mañana; tareas a mano, mensajes editables, avisos configurables y
 * grupos de clientas.
 */
test.describe.configure({ mode: "serial" });

let pagina: Page;
const cumple = `1990-${diaMadrid(0).slice(5)}`;

test.beforeAll(async ({ browser }) => {
  pagina = await browser.newPage();
  await registrarTpv(pagina);
});
test.afterAll(async () => pagina.close());

async function nuevaClienta(nombre: string, telefono: string, promociones: boolean) {
  await pagina.goto("/gestion/clientas/nueva");
  await pagina.getByLabel("Nombre").fill(nombre);
  await pagina.getByLabel("Teléfono").fill(telefono);
  await pagina.getByLabel(/^Cumpleaños/).fill(cumple);
  if (promociones) await pagina.getByLabel("Promociones y novedades").check();
  await pagina.getByRole("button", { name: "Crear clienta" }).click();
  await expect(pagina.getByRole("heading", { name: nombre })).toBeVisible();
}

const aviso = (texto: string | RegExp) => pagina.getByRole("list", { name: "Por hacer" }).getByRole("listitem").filter({ hasText: texto });

test("el inicio dice qué hay que hacer hoy, con el WhatsApp ya escrito", async () => {
  await nuevaClienta("Lucía Gómez", "655 10 20 30", true);
  await nuevaClienta("Nieves Prado", "655 40 50 60", false);

  await pagina.goto("/gestion");
  await expect(pagina.getByRole("heading", { name: "Qué hay que hacer hoy" })).toBeVisible();
  await pagina.goto("/gestion/avisos");
  const lucia = aviso("Hoy cumple años Lucía Gómez.");
  await expect(lucia).toBeVisible();
  // Sin permiso para promociones no hay botón: se explica por qué.
  await expect(aviso("Hoy cumple años Nieves Prado.")).toContainText(/WhatsApp: .*promociones/);
  await expect(aviso("Hoy cumple años Nieves Prado.").getByRole("link", { name: "WhatsApp" })).toHaveCount(0);

  const href = await lucia.getByRole("link", { name: "WhatsApp" }).getAttribute("href");
  expect(href).toMatch(/plantilla=cumpleanos/);
  const r = await pagina.request.get(href!, { maxRedirects: 0 });
  expect(r.status()).toBe(303);
  const destino = new URL(r.headers()["location"]!);
  expect(destino.href).toMatch(/^https:\/\/wa\.me\/34655102030/);
  expect(destino.searchParams.get("text")).toMatch(/^¡Feliz cumpleaños, Lucía!/);

  // Una vez escrito, deja de salir y queda en su ficha.
  await pagina.reload();
  await expect(aviso("Hoy cumple años Lucía Gómez.")).toHaveCount(0);
  await pagina.goto("/gestion/clientas?q=Lucía");
  await pagina.getByRole("link", { name: "Lucía Gómez" }).click();
  await expect(pagina.getByRole("list", { name: "Mensajes" })).toContainText("¡Feliz cumpleaños, Lucía!");
});

test("un aviso se puede dejar para mañana", async () => {
  await pagina.goto("/gestion/avisos");
  await aviso("Hoy cumple años Nieves Prado.").getByRole("button", { name: "Mañana" }).click();
  await expect(aviso("Hoy cumple años Nieves Prado.")).toHaveCount(0);
});

test("las tareas a mano salen en el inicio hasta que se hacen", async () => {
  await pagina.goto("/gestion/avisos");
  const form = pagina.getByRole("form", { name: "Nueva tarea" });
  await form.getByLabel("Qué hay que hacer").fill("Llamar a la gestoría por el IVA");
  await form.getByRole("button", { name: "Apuntar" }).click();
  await expect(pagina.getByText("Tarea apuntada: «Llamar a la gestoría por el IVA».")).toBeVisible();

  await pagina.goto("/gestion");
  await aviso("Llamar a la gestoría por el IVA").getByRole("button", { name: "Hecha" }).click();
  await expect(aviso("Llamar a la gestoría por el IVA")).toHaveCount(0);
  await pagina.goto("/gestion/avisos");
  await pagina.getByText("Últimas tareas hechas").click();
  await expect(pagina.getByText(/Llamar a la gestoría por el IVA · hecha por Adela/)).toBeVisible();
});

test("los mensajes se pueden cambiar, sin variables que no existen", async () => {
  await pagina.goto("/gestion/mas/whatsapp");
  const form = pagina.getByRole("form", { name: "Felicitación de cumpleaños" });
  const texto = form.getByRole("textbox");
  await texto.fill("Feliz cumple, {nombr}");
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(form.getByText(/No existe \{nombr\}/)).toBeVisible();
  await texto.fill("¡Muchas felicidades, {nombre}! Te esperamos en {centro}.");
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(form.getByText("Guardado.")).toBeVisible();

  // La ficha ofrece ese mensaje y lo prepara con el texto nuevo.
  await pagina.goto("/gestion/clientas?q=Lucía");
  await pagina.getByRole("link", { name: "Lucía Gómez" }).click();
  await pagina.locator("summary").filter({ hasText: /^WhatsApp$/ }).click();
  const href = await pagina.getByRole("link", { name: "Felicitación de cumpleaños" }).getAttribute("href");
  const r = await pagina.request.get(href!, { maxRedirects: 0 });
  expect(new URL(r.headers()["location"]!).searchParams.get("text")).toMatch(/^¡Muchas felicidades, Lucía!/);
});

test("grupos de clientas, con su WhatsApp cuando lo permiten", async () => {
  await pagina.goto("/gestion/clientas");
  await pagina.getByRole("link", { name: "Cumplen años este mes" }).click();
  const fila = (n: string) => pagina.locator("div").filter({ has: pagina.getByRole("link", { name: n, exact: true }) }).last();
  await expect(fila("Lucía Gómez")).toContainText(`Cumple el ${Number(cumple.slice(8))}`);
  await expect(fila("Lucía Gómez").getByRole("link", { name: "WhatsApp" })).toBeVisible();
  await expect(fila("Nieves Prado").getByRole("link", { name: "WhatsApp" })).toHaveCount(0);
  await pagina.getByRole("link", { name: "Aceptan promociones" }).click();
  await expect(pagina.getByRole("link", { name: "Lucía Gómez" })).toBeVisible();
  await expect(pagina.getByRole("link", { name: "Nieves Prado" })).toHaveCount(0);
});

test("los avisos automáticos se pueden apagar", async () => {
  await nuevaClienta("Rosa Marín", "655 70 80 90", true);
  await pagina.goto("/gestion/avisos");
  await expect(aviso("Hoy cumple años Rosa Marín.")).toBeVisible();
  await pagina.goto("/gestion/mas/configuracion/avisos");
  const form = pagina.getByRole("form", { name: "Avisos automáticos" });
  await form.getByRole("checkbox", { name: /Cumpleaños/ }).uncheck();
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(form.getByText("Guardado.")).toBeVisible();
  await pagina.goto("/gestion/avisos");
  await expect(aviso("Hoy cumple años Rosa Marín.")).toHaveCount(0);
  // Se deja como estaba.
  await pagina.goto("/gestion/mas/configuracion/avisos");
  await form.getByRole("checkbox", { name: /Cumpleaños/ }).check();
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(form.getByText("Guardado.")).toBeVisible();
});
