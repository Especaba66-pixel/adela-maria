import { expect, test, type Page } from "@playwright/test";
import { alerta, diaMadrid, registrarTpv, teclearPin } from "./ayudas";

/**
 * Fase 1 en el TPV: horario, citas (también repetidas), sin doble reserva, estados, mover, bloqueos,
 * fichas de clienta y agenda propia de una profesional.
 */
test.describe.configure({ mode: "serial" });

let pagina: Page;
const manana = diaMadrid(1);
const pasado = diaMadrid(2);

test.beforeAll(async ({ browser }) => {
  pagina = await browser.newPage();
  pagina.on("dialog", (d) => d.accept());
  await registrarTpv(pagina);
});
test.afterAll(async () => pagina.close());

async function abrirHueco(fecha: string, desde: string) {
  await pagina.goto(`/gestion/agenda?fecha=${fecha}`);
  await pagina.getByRole("link", { name: new RegExp(`^Hueco libre de ${desde}`) }).first().click();
  await expect(pagina.getByRole("heading", { name: "Nueva cita" })).toBeVisible();
}

async function elegirTratamientos(...nombres: string[]) {
  for (const n of nombres) await pagina.locator("label").filter({ hasText: new RegExp(`^${n}`) }).click();
}

async function elegirClienta(nombre: string) {
  await pagina.getByLabel("Buscar clienta").fill(nombre);
  await pagina.getByRole("button", { name: new RegExp(nombre) }).click();
  await expect(pagina.getByTestId("clienta-elegida")).toHaveText(nombre);
}

test("sin horario, el inicio avisa de que falta", async () => {
  await expect(pagina.getByText(/Falta el horario/)).toBeVisible();
});

test("la administración pone el horario de Adela: todos los días de 9 a 14 y de 16 a 21", async () => {
  await pagina.goto("/gestion/mas/configuracion/horario");
  const form = pagina.getByRole("form", { name: "Horario de Adela" });
  for (const dia of ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]) {
    await form.getByLabel(`${dia} tramo 1 desde`).fill("09:00");
    await form.getByLabel(`${dia} tramo 1 hasta`).fill("14:00");
    await form.getByLabel(`${dia} tramo 2 desde`).fill("16:00");
    await form.getByLabel(`${dia} tramo 2 hasta`).fill("21:00");
  }
  await form.getByRole("button", { name: "Guardar horario" }).click();
  await expect(pagina.getByText("Horario guardado.")).toBeVisible();
});

test("da una cita en tres toques desde un hueco libre, a una clienta nueva", async () => {
  await abrirHueco(manana, "09:00");
  await pagina.getByRole("button", { name: "+ Clienta nueva" }).click();
  await pagina.getByLabel("Nombre").fill("Carmen Ruiz");
  await pagina.getByLabel("Teléfono").fill("611 22 33 44");
  await elegirTratamientos("Axilas");
  await expect(pagina.getByLabel("Hora")).toHaveValue("09:00");
  await pagina.getByRole("button", { name: "Guardar cita" }).click();
  await expect(pagina.getByText("Cita guardada.")).toBeVisible();
  await expect(pagina.getByRole("heading", { level: 1 })).toContainText("09:00–09:10");
  await expect(pagina.getByText("Confirmada", { exact: true })).toBeVisible();
});

test("con dos cabinas deja dos citas a la vez, pero no tres", async () => {
  await pagina.goto(`/gestion/agenda/nueva?fecha=${manana}`);
  await elegirClienta("Carmen Ruiz");
  await elegirTratamientos("Ingles");
  await pagina.getByLabel("Hora").fill("09:05");
  await pagina.getByRole("button", { name: "Guardar cita" }).click();
  await expect(pagina.getByRole("heading", { level: 1 })).toContainText("09:05–09:20");

  await pagina.goto(`/gestion/agenda/nueva?fecha=${manana}`);
  await elegirClienta("Carmen Ruiz");
  await elegirTratamientos("Brazos");
  await pagina.getByLabel("Hora").fill("09:05");
  await pagina.getByRole("button", { name: "Guardar cita" }).click();
  await expect(alerta(pagina)).toHaveText("No queda cabina libre a esa hora.");
});

test("una cita con varios servicios suma sus duraciones, y las horas libres ya no ofrecen las ocupadas", async () => {
  await pagina.goto(`/gestion/agenda/nueva?fecha=${manana}`);
  await elegirClienta("Carmen Ruiz");
  await elegirTratamientos("Ceja y labio", "Brazos");
  await expect(pagina.getByRole("heading", { name: /30 min en total/ })).toBeVisible();
  await expect(pagina.getByRole("button", { name: "09:00", exact: true })).toHaveCount(0);
  await pagina.getByRole("button", { name: "10:00", exact: true }).click();
  await pagina.getByRole("button", { name: "Guardar cita" }).click();
  await expect(pagina.getByRole("heading", { level: 1 })).toContainText("10:00–10:30");
});

test("cambia el estado: ha venido y, si fue un error, se puede deshacer", async () => {
  await pagina.getByRole("button", { name: "Ha venido · realizada" }).click();
  await expect(pagina.getByText("Realizada", { exact: true })).toBeVisible();
  await pagina.getByRole("button", { name: "Volver a «Confirmada»" }).click();
  await expect(pagina.getByText("Confirmada", { exact: true })).toBeVisible();
});

test("mueve una cita de hora, pero no si no queda cabina", async () => {
  await pagina.getByLabel("Hora", { exact: true }).fill("09:00");
  await pagina.getByRole("button", { name: "Cambiar hora" }).click();
  await expect(alerta(pagina)).toHaveText("No queda cabina libre a esa hora.");
  await pagina.getByLabel("Hora", { exact: true }).fill("11:00");
  await pagina.getByRole("button", { name: "Cambiar hora" }).click();
  await expect(pagina.getByText("Cita cambiada de hora.")).toBeVisible();
  await expect(pagina.getByRole("heading", { level: 1 })).toContainText("11:00–11:30");
});

test("la vista de día muestra las citas y dónde queda cabina libre", async () => {
  await pagina.goto(`/gestion/agenda?fecha=${manana}`);
  const adela = pagina.getByRole("region", { name: "Agenda de Adela" });
  await expect(adela.getByText("3 citas")).toBeVisible();
  await expect(adela.getByRole("link", { name: /09:00–09:10 · Carmen Ruiz/ })).toBeVisible();
  await expect(adela.getByRole("link", { name: /09:05–09:20 · Carmen Ruiz/ })).toBeVisible();
  await expect(adela.getByRole("link", { name: /11:00–11:30 · Carmen Ruiz/ })).toBeVisible();
  // De 9:05 a 9:10 están las dos cabinas ocupadas; el resto de la mañana queda al menos una.
  await expect(adela.getByRole("link", { name: "Hueco libre de 09:00 a 09:05 con Adela" })).toBeVisible();
  await expect(adela.getByRole("link", { name: "Hueco libre de 09:10 a 14:00 con Adela" })).toBeVisible();
});

test("una cita que se repite crea toda la serie y se puede cancelar entera", async () => {
  await pagina.goto(`/gestion/agenda/nueva?fecha=${manana}`);
  await elegirClienta("Carmen Ruiz");
  await elegirTratamientos("Verse sin manchas");
  await pagina.getByLabel("Hora").fill("12:00");
  await pagina.getByLabel("Se repite").check();
  await pagina.getByLabel("Veces en total").fill("3");
  await pagina.getByRole("button", { name: "Guardar cita" }).click();
  await expect(pagina.getByText("Se han creado 3 citas (se repite).")).toBeVisible();

  await pagina.goto(`/gestion/agenda?vista=mes&fecha=${manana}`);
  await expect(pagina.getByRole("link", { name: /: 4 citas$/ }).first()).toBeVisible();

  await pagina.goto(`/gestion/agenda?fecha=${manana}`);
  await pagina.getByRole("link", { name: /12:00–13:30 · Carmen Ruiz/ }).click();
  await pagina.getByRole("button", { name: "Cancelar esta y las siguientes de la serie" }).click();
  await expect(pagina.getByText("3 citas canceladas.")).toBeVisible();
});

test("la administración añade el microblading, que va solo", async () => {
  await pagina.goto("/gestion/mas/tratamientos");
  const form = pagina.locator("form").filter({ has: pagina.getByRole("button", { name: "Añadir tratamiento" }) });
  await form.getByLabel("Nombre").fill("Microblading");
  await form.getByLabel("Categoría").selectOption({ label: "Cejas" });
  await form.getByLabel("Minutos").fill("120");
  await form.getByLabel("Precio (€)").fill("250");
  await form.getByLabel(/Va sola/).check();
  await form.getByRole("button", { name: "Añadir tratamiento" }).click();
  await expect(pagina.getByText("Tratamiento añadido.")).toBeVisible();
  await expect(pagina.getByText("120 min · va sola")).toBeVisible();
});

test("si una fecha de la serie choca, no se crea ninguna", async () => {
  await pagina.goto(`/gestion/agenda/nueva?fecha=${diaMadrid(8)}`);
  await elegirClienta("Carmen Ruiz");
  await elegirTratamientos("Microblading");
  await pagina.getByLabel("Hora").fill("16:00");
  await pagina.getByRole("button", { name: "Guardar cita" }).click();
  await expect(pagina.getByText("Cita guardada.")).toBeVisible();

  await pagina.goto(`/gestion/agenda/nueva?fecha=${manana}`);
  await elegirClienta("Carmen Ruiz");
  await elegirTratamientos("Axilas");
  await pagina.getByLabel("Hora").fill("17:00");
  await pagina.getByLabel("Se repite").check();
  await pagina.getByLabel("Veces en total").fill("2");
  await pagina.getByRole("button", { name: "Guardar cita" }).click();
  await expect(alerta(pagina)).toHaveText(/necesita a la profesional en exclusiva \(como el microblading\)\. No se ha creado ninguna\./);
  await pagina.goto(`/gestion/agenda?fecha=${manana}`);
  await expect(pagina.getByRole("link", { name: /17:00–17:10/ })).toHaveCount(0);
});

test("un día de vacaciones bloquea la agenda", async () => {
  await pagina.goto("/gestion/agenda/bloqueos");
  await pagina.getByLabel("Desde el día").fill(pasado);
  await pagina.getByLabel("Hasta el día").fill(pasado);
  await pagina.getByLabel("Motivo").fill("Formación");
  await pagina.getByRole("button", { name: "Guardar bloqueo" }).click();
  await expect(pagina.getByText(/Bloqueo guardado/)).toBeVisible();

  await pagina.goto(`/gestion/agenda?fecha=${pasado}`);
  await expect(pagina.getByText("Todo el día · Formación (todo el centro)")).toBeVisible();
  await expect(pagina.getByRole("link", { name: /^Hueco libre/ })).toHaveCount(0);

  await pagina.goto(`/gestion/agenda/nueva?fecha=${pasado}`);
  await elegirClienta("Carmen Ruiz");
  await elegirTratamientos("Axilas");
  await pagina.getByLabel("Hora").fill("10:00");
  await pagina.getByRole("button", { name: "Guardar cita" }).click();
  await expect(alerta(pagina)).toHaveText(/está bloqueada \(Formación\)/);
});

test("la ficha de la clienta reúne sus citas y notas", async () => {
  await pagina.goto("/gestion/clientas?q=611");
  await pagina.getByRole("link", { name: /Carmen Ruiz/ }).click();
  await expect(pagina.getByRole("heading", { name: "Carmen Ruiz" })).toBeVisible();
  // Mañana a las 9:00, 9:05 y 11:00, y el microblading de dentro de 8 días.
  await expect(pagina.getByText(/4 citas próximas/)).toBeVisible();
  await pagina.getByLabel("Nueva nota").fill("Prefiere por la mañana");
  await pagina.getByRole("button", { name: "Añadir nota" }).click();
  await expect(pagina.getByText("Prefiere por la mañana")).toBeVisible();
  await expect(pagina.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /wa\.me\/34611223344/);

  await pagina.getByLabel("Avisos de sus citas").check();
  await pagina.getByRole("button", { name: "Guardar ficha" }).click();
  await expect(pagina.getByText("Ficha guardada.")).toBeVisible();
  await pagina.reload();
  await expect(pagina.getByText(/Avisos de citas: sí \(centro\)/)).toBeVisible();
});

test("no deja dos fichas con el mismo teléfono", async () => {
  await pagina.goto("/gestion/clientas/nueva");
  await pagina.getByLabel("Nombre").fill("Otra Carmen");
  await pagina.getByLabel("Teléfono").fill("611223344");
  await pagina.getByRole("button", { name: "Crear clienta" }).click();
  await expect(alerta(pagina)).toHaveText("Ese teléfono ya es de Carmen Ruiz.");
});

test("si una clienta lo pide, se eliminan sus datos", async () => {
  await pagina.goto("/gestion/clientas/nueva");
  await pagina.getByLabel("Nombre").fill("Para Borrar");
  await pagina.getByLabel("Teléfono").fill("633 44 55 66");
  await pagina.getByRole("button", { name: "Crear clienta" }).click();
  await expect(pagina.getByRole("heading", { name: "Para Borrar" })).toBeVisible();
  const descarga = pagina.waitForEvent("download");
  await pagina.getByRole("link", { name: "Descargar sus datos" }).click();
  expect((await descarga).suggestedFilename()).toMatch(/^datos-clienta-.*\.json$/);
  await pagina.getByText("Eliminar sus datos…").click();
  await pagina.getByRole("button", { name: "Sí, eliminar sus datos" }).click();
  await expect(pagina.getByText("Datos de la clienta eliminados.")).toBeVisible();
  await pagina.goto("/gestion/clientas?q=Borrar");
  await expect(pagina.getByText("No hay ninguna clienta con ese nombre o teléfono.")).toBeVisible();
});

test("la vista de semana muestra las citas por día", async () => {
  await pagina.goto(`/gestion/agenda?vista=semana&fecha=${manana}`);
  const dia = pagina.getByRole("region").filter({ has: pagina.getByText("Carmen Ruiz").first() }).first();
  await expect(dia.getByText("09:00")).toBeVisible();
});

test("una profesional solo ve su propia agenda y no las fichas", async ({ browser }) => {
  // Alta de Rocío (profesional, PIN) y su agenda.
  await pagina.goto("/gestion/mas/configuracion/usuarios");
  const form = pagina.locator("form").filter({ has: pagina.getByRole("button", { name: "Crear usuario" }) });
  await form.getByLabel("Nombre").fill("Rocío");
  await form.getByLabel("Usuario").fill("rocio");
  await form.getByLabel("Rol").selectOption("profesional");
  await form.getByLabel(/PIN/).fill("5791");
  await form.getByRole("button", { name: "Crear usuario" }).click();
  await expect(pagina.getByText("Rocío ya puede entrar.")).toBeVisible();

  await pagina.goto("/gestion/mas/configuracion/profesionales");
  const nueva = pagina.locator("form").filter({ has: pagina.getByRole("button", { name: "Añadir profesional" }) });
  await nueva.getByLabel("Nombre").fill("Rocío");
  await nueva.getByLabel("Usuario que ve esta agenda").selectOption({ label: "Rocío" });
  await nueva.getByRole("button", { name: "Añadir profesional" }).click();
  await expect(pagina.getByRole("region", { name: "Rocío" })).toBeVisible();

  await pagina.getByRole("button", { name: "Cambiar de persona" }).click();
  await pagina.getByRole("button", { name: "Rocío" }).click();
  await teclearPin(pagina, "5791");
  await expect(pagina.getByTestId("usuario-actual")).toHaveText("Rocío");
  await pagina.goto(`/gestion/agenda?fecha=${manana}`);
  await expect(pagina.getByRole("region", { name: "Agenda de Rocío" })).toBeVisible();
  await expect(pagina.getByRole("region", { name: "Agenda de Adela" })).toHaveCount(0);
  await expect(pagina.getByRole("link", { name: "+ Nueva cita" })).toHaveCount(0);
  await pagina.goto("/gestion/clientas");
  await expect(pagina).toHaveURL(/\/gestion\/sin-permiso$/);

  // Vuelve Adela para las siguientes pruebas.
  await pagina.goto("/gestion");
  await pagina.getByRole("button", { name: "Cambiar de persona" }).click();
  await pagina.getByRole("button", { name: "Adela" }).click();
  await teclearPin(pagina, "2468");
  await expect(pagina.getByTestId("usuario-actual")).toHaveText("Adela");
  void browser;
});

test("el registro de actividad recoge las citas", async () => {
  await pagina.goto("/gestion/mas/configuracion/actividad");
  await expect(pagina.getByRole("row").filter({ hasText: "Dio una cita" }).first()).toBeVisible();
  await expect(pagina.getByRole("row").filter({ hasText: "Movió una cita" })).toHaveCount(1);
  await expect(pagina.getByRole("row").filter({ hasText: "Eliminó los datos de una clienta" })).toHaveCount(1);
});
