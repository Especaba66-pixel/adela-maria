import { expect, test, type Page } from "@playwright/test";
import { alerta, diaMadrid, registrarTpv } from "./ayudas";

/**
 * Fase 3 en el TPV: venta de un bono con la primera sesión el mismo día, descuento automático en la siguiente
 * visita, aviso cuando queda una, corrección de una sesión, y tarjetas regalo (venta, pago, consulta y devolución).
 * Va después de tpv.spec.ts (IVA y datos fiscales ya puestos; la caja quedó cerrada).
 */
test.describe.configure({ mode: "serial" });

let pagina: Page;
let codigo = "";
const hoy = diaMadrid(0);

test.beforeAll(async ({ browser }) => {
  pagina = await browser.newPage();
  pagina.on("dialog", (d) => d.accept());
  await registrarTpv(pagina);
});
test.afterAll(async () => pagina.close());

async function teclear(grupo: string, centimos: number) {
  const teclado = pagina.getByRole("group", { name: grupo });
  for (let i = 0; i < 8; i++) await teclado.getByRole("button", { name: "Borrar cifra" }).click();
  for (const c of String(centimos)) await teclado.getByRole("button", { name: c, exact: true }).click();
}
const formaDePago = (m: string) => pagina.getByRole("group", { name: "Forma de pago" }).getByRole("button", { name: m, exact: true });
const bonosYTarjetas = () => pagina.getByRole("group", { name: "Bonos y tarjetas regalo" });

async function citaDeHoy(hora: string, tratamiento: string, clienta: { nueva?: string; telefono?: string; existente?: string }) {
  await pagina.goto(`/gestion/agenda/nueva?fecha=${hoy}`);
  if (clienta.nueva) {
    await pagina.getByRole("button", { name: "+ Clienta nueva" }).click();
    await pagina.getByLabel("Nombre").fill(clienta.nueva);
    await pagina.getByLabel("Teléfono").fill(clienta.telefono!);
  } else {
    await pagina.getByLabel("Buscar clienta").fill(clienta.existente!);
    await pagina.getByRole("button", { name: new RegExp(clienta.existente!) }).click();
  }
  await pagina.locator("label").filter({ hasText: new RegExp(`^${tratamiento.replace(/[()]/g, "\\$&")}`) }).click();
  await pagina.getByLabel("Hora").fill(hora);
  await pagina.getByRole("button", { name: "Guardar cita" }).click();
  await expect(pagina.getByText("Cita guardada.")).toBeVisible();
}

test("se abre la caja", async () => {
  await pagina.goto("/gestion/caja");
  await teclear("Fondo inicial", 5000);
  await pagina.getByRole("button", { name: /Abrir caja con 50,00/ }).click();
  await expect(pagina.getByRole("heading", { name: "Caja abierta" })).toBeVisible();
});

test("un bono necesita clienta", async () => {
  await pagina.goto("/gestion/tpv");
  await bonosYTarjetas().getByRole("button", { name: /^Bono facial 3 sesiones/ }).click();
  await expect(pagina.getByText("Elige la clienta: el bono va a su nombre.")).toBeVisible();
});

test("compra el bono al cobrar su cita y la sesión de hoy ya va con él", async () => {
  await citaDeHoy("16:30", "Verse limpia y purificada (higiene facial)", { nueva: "Marta Ruiz", telefono: "677 90 12 34" });
  await pagina.getByRole("link", { name: "Cobrar", exact: true }).click();
  await expect(pagina.getByRole("heading", { name: "Marta Ruiz" })).toBeVisible();
  await expect(pagina.getByTestId("total")).toHaveText("30,00 €");

  await bonosYTarjetas().getByRole("button", { name: /^Bono facial 3 sesiones/ }).click();
  const linea = pagina.getByRole("listitem", { name: "Línea Verse limpia y purificada (higiene facial)" });
  await expect(linea).toContainText("Con bono");
  await expect(linea).toContainText("(el que compra ahora)");
  await expect(pagina.getByTestId("total")).toHaveText("120,00 €");
  await formaDePago("Tarjeta").click();
  await pagina.getByRole("button", { name: /^Cobrar 120,00/ }).click();

  const ticket = pagina.getByLabel("Ticket");
  await expect(ticket).toContainText("Bono facial 3 sesiones");
  await expect(ticket).not.toContainText("Verse limpia");
  await expect(ticket).toContainText("Bono facial 3 sesiones: te quedan 2 sesiones.");
});

test("en la siguiente visita el bono se descuenta solo, sin cobrar ni facturar", async () => {
  await citaDeHoy("18:00", "Sin arruguitas", { existente: "Marta Ruiz" });
  await pagina.getByRole("link", { name: "Cobrar", exact: true }).click();
  await expect(pagina.getByRole("list", { name: "Bonos de la clienta" })).toContainText("Bono facial 3 sesiones: queda 1 sesión");
  await expect(pagina.getByRole("listitem", { name: "Línea Sin arruguitas" })).toContainText("Con bono");
  await expect(pagina.getByTestId("total")).toHaveText("0,00 €");
  await pagina.getByRole("button", { name: "Descontar del bono" }).click();

  await expect(pagina.getByText("Sesión descontada. Le queda 1 sesión.")).toBeVisible();
  await expect(pagina.getByTestId("sesiones-quedan")).toHaveText("1 de 3");
  await expect(pagina.getByText("Sin arruguitas")).toBeVisible();

  await pagina.goto("/gestion/tpv");
  await expect(pagina.getByRole("region", { name: "Citas por cobrar" }).getByText("Marta Ruiz")).toHaveCount(0);
});

test("el inicio avisa del bono a punto de acabar, y la ficha lo enseña", async () => {
  await pagina.goto("/gestion");
  await expect(pagina.getByTestId("tarjeta-Bonos por acabar")).toHaveText("1");
  await pagina.goto("/gestion/clientas");
  await pagina.getByRole("link", { name: /Marta Ruiz/ }).first().click();
  await expect(pagina.getByRole("region", { name: "Bonos" })).toContainText("Le queda 1 sesión");
});

test("una sesión descontada por error se devuelve, con su motivo", async () => {
  await pagina.getByRole("region", { name: "Bonos" }).getByRole("link", { name: /Bono facial 3 sesiones/ }).click();
  await pagina.getByText("Devolver una sesión al bono…").click();
  await pagina.getByLabel("Motivo").fill("Se descontó de más");
  await pagina.getByRole("button", { name: "Devolver la sesión" }).click();
  await expect(pagina.getByText("Sesión devuelta al bono.")).toBeVisible();
  await expect(pagina.getByTestId("sesiones-quedan")).toHaveText("2 de 3");
  await expect(pagina.getByText("Sesión devuelta: Se descontó de más")).toBeVisible();
});

test("vende una tarjeta regalo de 50 €: vale con código, sin factura", async () => {
  await pagina.goto("/gestion/tpv");
  await bonosYTarjetas().getByRole("button", { name: /^Tarjeta regalo/ }).click();
  await pagina.getByRole("group", { name: "Importe de la tarjeta regalo" }).getByRole("button", { name: /^50 €$/ }).click();
  await pagina.getByLabel("Para quién es").fill("Lucía");
  await pagina.getByLabel("De parte de").fill("Su hermana");
  await expect(pagina.getByLabel("Quiere factura con sus datos")).toHaveCount(0);
  await formaDePago("Efectivo").click();
  await pagina.getByRole("group", { name: "Entregado" }).getByRole("button", { name: /^50 €$/ }).click();
  await pagina.getByRole("button", { name: /^Cobrar 50,00/ }).click();

  await expect(pagina.getByRole("heading", { name: "Tarjeta regalo vendida" })).toBeVisible();
  const vale = pagina.getByLabel("Vale");
  await expect(vale).toContainText("TARJETA REGALO");
  await expect(vale).toContainText("Para: Lucía");
  await expect(vale).toContainText("De parte de: Su hermana");
  await expect(vale).toContainText("sin valor de factura");
  await expect(pagina.getByTestId("saldo")).toHaveText("50,00 €");
  codigo = (await vale.textContent())!.match(/AM-[A-Z0-9]{4}-[A-Z0-9]{4}/)![0];
});

test("se paga con la tarjeta (el código como se escriba) y el resto con tarjeta bancaria", async () => {
  await pagina.goto("/gestion/tpv");
  await pagina.getByRole("region", { name: "Tratamientos" }).getByRole("button", { name: /^Verse sin manchas/ }).click();
  await pagina.getByRole("region", { name: "Tratamientos" }).getByRole("button", { name: /^Brazos/ }).click();
  await expect(pagina.getByTestId("total")).toHaveText("53,00 €");
  await formaDePago("Tarjeta regalo").click();
  await pagina.getByLabel("Código de la tarjeta regalo").fill("AM-0000-0000");
  await pagina.getByRole("button", { name: "Comprobar" }).click();
  await expect(alerta(pagina)).toHaveText("No existe ninguna tarjeta regalo con ese código.");
  await pagina.getByLabel("Código de la tarjeta regalo").fill(codigo.toLowerCase().replaceAll("-", " "));
  await pagina.getByRole("button", { name: "Comprobar" }).click();
  await expect(pagina.getByText(`Tarjeta ${codigo}: saldo 50,00 €.`)).toBeVisible();
  await pagina.getByRole("button", { name: /Pagar 50,00 .* así y el resto de otra forma/ }).click();
  await formaDePago("Tarjeta").click();
  await pagina.getByRole("button", { name: /^Cobrar 53,00/ }).click();

  const ticket = pagina.getByLabel("Ticket");
  await expect(ticket).toContainText("FACTURA SIMPLIFICADA");
  await expect(ticket).toContainText(/Tarjeta regalo\s+50,00 €/);
  await expect(ticket).toContainText(/Tarjeta\s+3,00 €/);
  await expect(ticket).toContainText(`Tarjeta regalo ${codigo}: saldo 0,00 €.`);
});

test("se consulta por su código en Bonos y tarjetas regalo", async () => {
  await pagina.goto("/gestion/mas/bonos");
  await expect(pagina.getByRole("region", { name: "Bonos activos" })).toContainText("Marta Ruiz");
  await pagina.getByLabel("Consultar una tarjeta regalo").fill(codigo);
  await pagina.getByRole("button", { name: "Consultar" }).click();
  await expect(pagina.getByRole("heading", { name: `Tarjeta regalo ${codigo}` })).toBeVisible();
  await expect(pagina.getByTestId("saldo")).toHaveText("0,00 €");
  await expect(pagina.getByText(/Gastada · de 50,00/)).toBeVisible();
});

test("una tarjeta sin estrenar se puede devolver y deja de valer", async () => {
  await pagina.goto("/gestion/tpv");
  await bonosYTarjetas().getByRole("button", { name: /^Tarjeta regalo/ }).click();
  await teclear("Importe de la tarjeta regalo", 2000);
  await formaDePago("Bizum").click();
  await pagina.getByRole("button", { name: /^Cobrar 20,00/ }).click();
  await expect(pagina.getByRole("heading", { name: "Tarjeta regalo vendida" })).toBeVisible();
  await pagina.getByText("Devolver esta tarjeta…").click();
  await pagina.getByLabel("Cómo se devuelve el dinero").selectOption("bizum");
  await pagina.getByLabel("Motivo").fill("Se equivocó de importe");
  await pagina.getByRole("button", { name: "Devolver la tarjeta" }).click();
  await expect(pagina.getByText("Tarjeta devuelta: se ha devuelto el dinero y ya no se puede usar.")).toBeVisible();
  await expect(pagina.getByText(/Anulada · de 20,00/)).toBeVisible();
});

test("la caja separa lo cobrado con tarjeta regalo", async () => {
  await pagina.goto("/gestion/caja");
  // 50 de fondo + 50 de la tarjeta regalo vendida en efectivo.
  await expect(pagina.getByTestId("efectivo-esperado")).toHaveText("100,00 €");
  await expect(pagina.getByText("Cobrado con tarjeta regalo").locator("..")).toContainText("50,00 €");
});

test("el registro de actividad recoge bonos y tarjetas", async () => {
  await pagina.goto("/gestion/mas/configuracion/actividad");
  for (const accion of ["Usó un bono", "Devolvió una sesión de bono", "Vendió una tarjeta regalo", "Devolvió una tarjeta regalo"]) {
    await expect(pagina.getByRole("row").filter({ hasText: accion }).first()).toBeVisible();
  }
});
