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

test("lo primero de la web es el calendario: la clienta elige tratamiento, día y hora y reserva", async () => {
  await clienta.goto(RESERVAS.landing);
  await expect(clienta.getByRole("heading", { level: 1 })).toHaveText("Reserva tu cita");
  await clienta.getByRole("combobox", { name: /Tratamiento/ }).selectOption({ label: "Ingles · 5 €" });
  const dia = clienta.getByRole("group", { name: "Día" }).getByRole("button").and(clienta.locator(":not([disabled])")).nth(2);
  await dia.click();
  const hora = clienta.getByRole("group", { name: "Hora" }).getByRole("button").first();
  const textoHora = (await hora.textContent())!;
  await hora.click();
  await clienta.getByRole("textbox", { name: "Nombre" }).fill("Rosa Web");
  await clienta.getByRole("textbox", { name: "Teléfono (WhatsApp)" }).fill("633 21 21 21");
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
