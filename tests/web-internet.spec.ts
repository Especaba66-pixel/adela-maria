import { expect, test, type Page } from "@playwright/test";
import { RESERVAS } from "../playwright.config";
import { registrarTpv } from "./ayudas";

/**
 * Reservas por internet: la clienta reserva en la landing (servicio de Cloudflare, en local), con el TPV apagado
 * o encendido; el TPV se trae la reserva a su agenda y le manda lo ocupado. Dos a la vez sí (dos cabinas), tres no.
 * Va la última: las demás pruebas cuentan reservas pendientes.
 */
test.describe.configure({ mode: "serial" });

let tpv: Page;
let clienta: Page;
let reserva: { servicio: string; fecha: string; minutos: number; hora: string };

test.beforeAll(async ({ browser }) => {
  tpv = await browser.newPage();
  tpv.on("dialog", (d) => d.accept());
  await registrarTpv(tpv);
  clienta = await browser.newPage({ viewport: { width: 390, height: 844 } });
});
test.afterAll(async () => {
  await tpv.close();
  await clienta.close();
});

const sincronizar = async () => {
  await tpv.goto("/gestion/reservas");
  // Se espera a que termine (puede quedar en pantalla el resultado de una sincronización anterior).
  await Promise.all([tpv.waitForResponse((r) => r.request().method() === "POST"), tpv.getByRole("button", { name: "Sincronizar ahora" }).click()]);
  await tpv.reload();
  await expect(tpv.getByTestId("estado-internet")).toContainText("al día");
};

async function horasLibres(): Promise<number[]> {
  const url = `${RESERVAS.url}/api/disponibilidad?${new URLSearchParams({ servicio: reserva.servicio, desde: reserva.fecha, dias: "1" })}`;
  const r = await (await fetch(url)).json();
  return r.dias[0].horas;
}

const reservarPorApi = (nombre: string, telefono: string) =>
  fetch(`${RESERVAS.url}/api/reservas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ servicio: reserva.servicio, fecha: reserva.fecha, minutos: reserva.minutos, nombre, telefono, acepta: true }),
  });

test("el TPV manda su agenda al servicio de internet", async () => {
  await sincronizar();
  const { servicios } = await (await fetch(`${RESERVAS.url}/api/servicios`)).json();
  // Ya son los tratamientos del TPV (con sus ids), no los de partida.
  expect(servicios.find((s: { nombre: string }) => s.nombre === "Ingles").id).toMatch(/^[0-9a-f-]{36}$/);
});

test("arriba el lema con las fotos y, en la misma pantalla, los servicios: la clienta abre uno, ve el precio y reserva", async () => {
  await clienta.goto(RESERVAS.landing);
  await expect(clienta.locator(".portada.con-fotos")).toBeInViewport();
  await expect(clienta.getByRole("heading", { level: 1 })).toHaveText("Cuidamos de ti");
  // Sin bajar: en la primera vista del móvil ya están los servicios.
  const menu = clienta.getByRole("navigation", { name: "Nuestros servicios" });
  await expect(menu.getByText("Depilación", { exact: true })).toBeInViewport();
  await menu.getByText("Depilación", { exact: true }).click();
  await expect(menu.locator("#cat-depilacion")).toContainText(/Ingles\s*15 min · 5\s€/);
  await menu.getByRole("link", { name: "Reservar: Ingles" }).click();
  await expect(clienta.getByRole("combobox", { name: /Tratamiento/ })).toBeInViewport();
  await expect(clienta.getByRole("combobox", { name: /Tratamiento/ }).locator("option:checked")).toHaveText("Ingles · 5 €");
  const dia = clienta.getByRole("group", { name: "Día" }).getByRole("button").and(clienta.locator(":not([disabled])")).nth(2);
  await dia.click();
  const hora = clienta.getByRole("group", { name: "Hora" }).getByRole("button").first();
  const textoHora = (await hora.textContent())!;
  await hora.click();
  await clienta.getByRole("textbox", { name: "Nombre" }).fill("Rosa Web");
  await clienta.getByRole("textbox", { name: "Teléfono" }).fill("633 21 21 21");
  await clienta.getByRole("button", { name: "Reservar", exact: true }).click();
  await expect(clienta.getByRole("alert").filter({ hasText: /aceptar el uso de tus datos/ })).toBeVisible();
  await clienta.getByRole("checkbox").check();
  await clienta.getByRole("button", { name: "Reservar", exact: true }).click();
  await expect(clienta.getByRole("status").filter({ hasText: "¡Reserva recibida!" })).toContainText(`a las ${textoHora}`);

  // Datos de la reserva hecha, para lo que sigue.
  const { servicios } = await (await fetch(`${RESERVAS.url}/api/servicios`)).json();
  const ingles = servicios.find((s: { nombre: string }) => s.nombre === "Ingles");
  const [hh, mm] = textoHora.split(":").map(Number);
  const pedidas = await (await fetch(`${RESERVAS.url}/api/sync/reservas`, { headers: { Authorization: `Bearer ${RESERVAS.clave}` } })).json();
  const r = pedidas.reservas.at(-1);
  const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date(r.inicio));
  reserva = { servicio: ingles.id, fecha, minutos: hh! * 60 + mm!, hora: textoHora };
});

test("con dos cabinas cabe otra reserva a la misma hora, pero no una tercera", async () => {
  expect((await reservarPorApi("Eva Web", "633 21 21 22")).status).toBe(201);
  const tercera = await reservarPorApi("Ana Web", "633 21 21 23");
  expect(tercera.status).toBe(409);
  expect((await tercera.json()).error).toBe("Esa hora acaba de ocuparse. Elige otra, por favor.");
  expect(await horasLibres()).not.toContain(reserva.minutos);
});

test("el TPV se trae las reservas a la agenda, por confirmar", async () => {
  await sincronizar();
  await expect(tpv.getByTestId("estado-internet")).toContainText("2 nuevas");
  await expect(tpv.getByRole("region", { name: "Cita web de Rosa Web" })).toBeVisible();
  await expect(tpv.getByRole("region", { name: "Cita web de Eva Web" })).toBeVisible();
  // En internet ya no queda ningún dato personal de las importadas, y la hora sigue completa (ahora por la agenda).
  const pedidas = await (await fetch(`${RESERVAS.url}/api/sync/reservas`, { headers: { Authorization: `Bearer ${RESERVAS.clave}` } })).json();
  expect(pedidas.reservas).toHaveLength(0);
  expect(await horasLibres()).not.toContain(reserva.minutos);
});

test("al rechazar una, el hueco vuelve a estar libre en internet", async () => {
  const eva = tpv.getByRole("region", { name: "Cita web de Eva Web" });
  await eva.getByRole("button", { name: /Rechazar/ }).click();
  await expect(eva).toHaveCount(0);
  await sincronizar();
  await expect.poll(horasLibres).toContain(reserva.minutos);
});

test("sin la clave, nadie puede leer las reservas ni cambiar la agenda de internet", async () => {
  expect((await fetch(`${RESERVAS.url}/api/sync/reservas`)).status).toBe(401);
  expect((await fetch(`${RESERVAS.url}/api/sync/reservas`, { headers: { Authorization: "Bearer otra-clave-que-no-es-la-buena-de-ningun-modo" } })).status).toBe(401);
  expect((await fetch(`${RESERVAS.url}/api/sync`, { method: "POST", body: "{}" })).status).toBe(401);
});

test("las uñas que el centro tiene en el TPV salen en la web en su apartado, y se reservan con un toque", async () => {
  // Sin servicios de uñas con duración, el apartado no sale (nada vacío).
  await clienta.goto(RESERVAS.landing);
  const menu = clienta.getByRole("navigation", { name: "Nuestros servicios" });
  await expect(clienta.locator("#r-servicio option").nth(1)).toBeAttached();
  await expect(menu.getByText("Uñas", { exact: true })).toBeHidden();

  await tpv.goto("/gestion/mas/tratamientos");
  const form = tpv.locator("form").filter({ has: tpv.getByRole("button", { name: "Añadir tratamiento" }) });
  await form.getByLabel("Nombre").fill("uñas permanente con retirada");
  await form.getByLabel("Categoría").selectOption({ label: "Microblading, maquillaje y uñas" });
  await form.getByLabel("Minutos").fill("75");
  await form.getByLabel("Precio (€)").fill("15");
  await form.getByRole("button", { name: "Añadir tratamiento" }).click();
  await expect(tpv.getByText("«uñas permanente con retirada» añadido.")).toBeVisible();
  await sincronizar();

  await clienta.goto(RESERVAS.landing);
  await menu.getByText("Uñas", { exact: true }).click();
  const unas = menu.locator("#cat-unas");
  await expect(unas).toContainText("desde 15 €");
  await expect(unas.getByRole("listitem")).toHaveCount(1);
  await expect(unas.getByRole("listitem")).toContainText("Uñas permanente con retirada");
  await expect(unas.getByRole("listitem")).toContainText("1 h 15 min · 15 €");
  await unas.getByRole("link", { name: "Reservar: Uñas permanente con retirada" }).click();
  await expect(clienta.locator("#r-servicio option:checked")).toHaveText(/^Uñas permanente con retirada/);
  await expect(clienta.locator("#r-servicio optgroup[label='Uñas']")).toHaveCount(1);
  await expect(clienta.getByRole("group", { name: "Día" }).getByRole("button").first()).toBeVisible();
});

test("toda la lista de servicios de la web sigue al TPV: precios nuevos, lo retirado no sale y lo nuevo sí", async () => {
  await tpv.goto("/gestion/mas/tratamientos");
  const editar = async (nombre: string, cambio: (f: ReturnType<Page["locator"]>) => Promise<void>) => {
    await tpv.getByLabel(`Editar ${nombre}`, { exact: true }).click();
    const form = tpv.locator("details", { has: tpv.getByLabel(`Editar ${nombre}`, { exact: true }) }).locator("form");
    await cambio(form);
    await Promise.all([tpv.waitForResponse((r) => r.request().method() === "POST"), form.getByRole("button", { name: "Guardar" }).click()]);
    await tpv.reload();
  };
  await editar("Axilas", (f) => f.getByLabel("Precio (€)").fill("6"));
  await editar("Brazos", (f) => f.getByLabel(/Retirado/).check());
  await tpv.getByLabel("Nueva categoría").fill("Novedades");
  await tpv.getByRole("button", { name: "Crear", exact: true }).click();
  const nuevo = tpv.locator("form").filter({ has: tpv.getByRole("button", { name: "Añadir tratamiento" }) });
  await nuevo.getByLabel("Nombre").fill("Masaje de prueba");
  await nuevo.getByLabel("Categoría").selectOption({ label: "Novedades" });
  await nuevo.getByLabel("Minutos").fill("30");
  await nuevo.getByLabel("Precio (€)").fill("20");
  await nuevo.getByRole("button", { name: "Añadir tratamiento" }).click();
  await expect(tpv.getByText("«Masaje de prueba» añadido.")).toBeVisible();
  await sincronizar();

  await clienta.goto(RESERVAS.landing);
  const menu = clienta.getByRole("navigation", { name: "Nuestros servicios" });
  await expect(menu.locator("#cat-novedades")).toBeVisible();
  await menu.getByText("Depilación", { exact: true }).click();
  const depilacion = menu.locator("#cat-depilacion");
  await expect(depilacion).toContainText(/Axilas\s*10 min · 6\s€/);
  await expect(depilacion.getByText("Brazos", { exact: true })).toHaveCount(0);
  await menu.getByText("Novedades", { exact: true }).click();
  await expect(menu.locator("#cat-novedades")).toContainText(/Masaje de prueba\s*30 min · 20\s€/);
  await menu.getByRole("link", { name: "Reservar: Masaje de prueba" }).click();
  await expect(clienta.locator("#r-servicio option:checked")).toHaveText(/^Masaje de prueba/);
});

test("si el móvil no consigue conectar, la web no se queda «cargando»: lo reintenta, avisa y deja volver a intentarlo", async ({ browser }) => {
  const pagina = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await pagina.route(`${RESERVAS.url}/api/servicios`, (r) => r.abort());
  await pagina.goto(RESERVAS.landing);
  const tratamiento = pagina.getByRole("combobox", { name: /Tratamiento/ });
  await expect(tratamiento.locator("option").first()).toHaveText("No disponible ahora", { timeout: 15_000 });
  await expect(pagina.getByText(/no se puede cargar el calendario/)).toBeVisible();
  // Vuelve la conexión: con un toque se cargan los tratamientos.
  await pagina.unroute(`${RESERVAS.url}/api/servicios`);
  await pagina.getByRole("button", { name: "Volver a intentarlo" }).click();
  await expect(tratamiento.locator("option", { hasText: "Ingles" })).toHaveCount(1);
  await expect(pagina.getByText(/no se puede cargar el calendario/)).toBeHidden();
  await pagina.close();
});

test("la web también la sirve el propio servicio de reservas (para Instagram): misma dirección y se reserva igual", async ({ browser }) => {
  const pagina = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const llamadas: string[] = [];
  pagina.on("request", (r) => { if (r.url().includes("/api/")) llamadas.push(new URL(r.url()).origin); });
  await pagina.goto(`${RESERVAS.url}/`);
  await expect(pagina.getByRole("heading", { level: 1 })).toHaveText("Cuidamos de ti");
  const menu = pagina.getByRole("navigation", { name: "Nuestros servicios" });
  await menu.getByText("Depilación", { exact: true }).click();
  await menu.getByRole("link", { name: "Reservar: Axilas" }).click();
  await expect(pagina.getByRole("combobox", { name: /Tratamiento/ }).locator("option:checked")).toHaveText(/^Axilas/);
  await expect(pagina.getByRole("group", { name: "Día" }).getByRole("button").first()).toBeVisible();
  // Todo con la misma dirección que la página: nada que bloquear.
  expect(new Set(llamadas)).toEqual(new Set([RESERVAS.url]));
  await pagina.close();
});
