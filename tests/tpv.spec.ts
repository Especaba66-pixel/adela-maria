import { expect, test, type Page } from "@playwright/test";
import { alerta, diaMadrid, registrarTpv } from "./ayudas";

/**
 * Fase 2 en el TPV: datos fiscales e IVA, impresora (simulada), caja, cobros (efectivo con cambio, pago mixto,
 * a deber, factura con datos), devolución con rectificativa y cierre de caja con descuadre.
 */
test.describe.configure({ mode: "serial" });

let pagina: Page;
const hoy = diaMadrid(0);
const anio = hoy.slice(0, 4);

test.beforeAll(async ({ browser }) => {
  pagina = await browser.newPage();
  pagina.on("dialog", (d) => d.accept());
  await registrarTpv(pagina);
});
test.afterAll(async () => pagina.close());

/** Escribe un importe en el teclado numérico indicado (en céntimos, como un datáfono). */
async function teclear(grupo: string, centimos: number) {
  const teclado = pagina.getByRole("group", { name: grupo });
  for (let i = 0; i < 8; i++) await teclado.getByRole("button", { name: "Borrar cifra" }).click();
  for (const c of String(centimos)) await teclado.getByRole("button", { name: c, exact: true }).click();
}

async function anadir(tratamiento: string) {
  await pagina.getByRole("region", { name: "Tratamientos" }).getByRole("button", { name: new RegExp(`^${tratamiento.replace(/[()]/g, "\\$&")}`) }).click();
}

const formaDePago = (m: string) => pagina.getByRole("group", { name: "Forma de pago" }).getByRole("button", { name: m, exact: true });

test("sin IVA ni datos fiscales, el inicio avisa de que no se puede cobrar", async () => {
  await expect(pagina.getByText(/Faltan los datos fiscales del centro/)).toBeVisible();
  await expect(pagina.getByText(/Hay tratamientos sin IVA/)).toBeVisible();
});

test("la administración pone el IVA a todos los tratamientos de una vez", async () => {
  await pagina.goto("/gestion/mas/tratamientos");
  await pagina.getByLabel("IVA (%)").first().fill("21");
  await pagina.getByRole("button", { name: "Poner a todos" }).click();
  await expect(pagina.getByText(/IVA del 21 % puesto a \d+ tratamientos\./)).toBeVisible();
  await expect(pagina.getByText("· IVA 21 %").first()).toBeVisible();
});

test("y los datos fiscales, comprobando la letra del NIF", async () => {
  await pagina.goto("/gestion/mas/configuracion/centro");
  await pagina.getByLabel("Nombre fiscal (titular)").fill("Adela María Pérez");
  await pagina.getByLabel("NIF").fill("12345678A");
  await pagina.getByLabel("Dirección fiscal").fill("Calle Mayor 1, 03001 Alicante");
  await pagina.getByRole("button", { name: "Guardar" }).click();
  await expect(alerta(pagina)).toHaveText(/la letra no cuadra/);
  await pagina.getByLabel("NIF").fill("12345678Z");
  await pagina.getByLabel(/Mensaje al pie del ticket/).fill("¡Gracias por tu visita!");
  await pagina.getByRole("button", { name: "Guardar" }).click();
  await expect(pagina.getByText(/Guardado/)).toBeVisible();
});

test("la impresora simulada imprime una prueba", async () => {
  await pagina.goto("/gestion/mas/configuracion/impresora");
  await pagina.getByLabel("Cómo está conectada").selectOption("simulador");
  await pagina.getByRole("button", { name: "Guardar" }).click();
  await expect(pagina.getByText("Impresora guardada.")).toBeVisible();
  await pagina.getByRole("button", { name: "Imprimir prueba" }).click();
  await expect(pagina.getByText(/^Simulado: /)).toBeVisible();
});

test("con la caja cerrada no se cobra; se abre con un fondo de 50 €", async () => {
  await pagina.goto("/gestion/tpv");
  await anadir("Axilas");
  await expect(pagina.getByText("La caja está cerrada: ábrela en Caja para cobrar.")).toBeVisible();
  await pagina.goto("/gestion/caja");
  await teclear("Fondo inicial", 5000);
  await pagina.getByRole("button", { name: /Abrir caja con 50,00/ }).click();
  await expect(pagina.getByRole("heading", { name: "Caja abierta" })).toBeVisible();
  await expect(pagina.getByTestId("efectivo-esperado")).toHaveText("50,00 €");
});

test("cobra una cita de hoy en efectivo, con cambio, y la cita queda realizada", async () => {
  await pagina.goto(`/gestion/agenda/nueva?fecha=${hoy}`);
  await pagina.getByRole("button", { name: "+ Clienta nueva" }).click();
  await pagina.getByLabel("Nombre").fill("Lucía Gómez");
  await pagina.getByLabel("Teléfono").fill("655 44 33 22");
  await pagina.locator("label").filter({ hasText: /^Axilas/ }).click();
  await pagina.getByLabel("Hora").fill("13:00");
  await pagina.getByRole("button", { name: "Guardar cita" }).click();
  await expect(pagina.getByText("Cita guardada.")).toBeVisible();

  await pagina.getByRole("link", { name: "Cobrar", exact: true }).click();
  await expect(pagina.getByRole("heading", { name: "Lucía Gómez" })).toBeVisible();
  await expect(pagina.getByTestId("total")).toHaveText("5,00 €");
  await formaDePago("Efectivo").click();
  await pagina.getByRole("group", { name: "Entregado" }).getByRole("button", { name: /^10 €$/ }).click();
  await expect(pagina.getByTestId("cambio")).toHaveText("5,00 €");
  await pagina.getByRole("button", { name: /^Cobrar 5,00/ }).click();

  await expect(pagina.getByRole("heading", { name: "Cobrado" })).toBeVisible();
  await expect(pagina.getByTestId("cambio-final")).toHaveText("5,00 €");
  const ticket = pagina.getByLabel("Ticket");
  await expect(ticket).toContainText("FACTURA SIMPLIFICADA");
  await expect(ticket).toContainText(`T${anio}-000001`);
  await expect(ticket).toContainText("NIF 12345678Z");
  await expect(ticket).toContainText("Axilas");
  await expect(ticket).toContainText("¡Gracias por tu visita!");
  await expect(pagina.getByRole("link", { name: "Enviar por WhatsApp" })).toHaveAttribute("href", /wa\.me\/34655443322/);

  await pagina.goto("/gestion/tpv");
  await expect(pagina.getByRole("region", { name: "Citas por cobrar" }).getByText("Lucía Gómez")).toHaveCount(0);
});

test("venta libre con descuento y pago mixto: parte con tarjeta y el resto por Bizum", async () => {
  await pagina.goto("/gestion/tpv");
  await anadir("Verse sin manchas");
  await anadir("Brazos");
  await pagina.getByLabel("Descuento de Verse sin manchas").selectOption({ label: "−10 %" });
  await expect(pagina.getByTestId("total")).toHaveText("48,50 €");
  await formaDePago("Tarjeta").click();
  await pagina.getByText("Cobrar solo una parte").click();
  await teclear("Importe de este pago", 2000);
  await pagina.getByRole("button", { name: /Pagar 20,00 .* así y el resto de otra forma/ }).click();
  await formaDePago("Bizum").click();
  await pagina.getByRole("button", { name: /^Cobrar 48,50/ }).click();
  const ticket = pagina.getByLabel("Ticket");
  await expect(ticket).toContainText(`T${anio}-000002`);
  await expect(ticket).toContainText("dto. 10 %");
  await expect(ticket).toContainText(/Tarjeta\s+20,00 €/);
  await expect(ticket).toContainText(/Bizum\s+28,50 €/);
});

test("se puede dejar a deber y cobrarlo después", async () => {
  await pagina.goto("/gestion/tpv");
  await anadir("Ingles");
  await pagina.getByRole("button", { name: "Dejarlo todo a deber" }).click();
  await expect(pagina.getByText(/Quedan 5,00\s€ a deber/)).toBeVisible();
  await pagina.goto("/gestion");
  await expect(pagina.getByTestId("tarjeta-Pendientes de cobro")).toHaveText("1");
  await pagina.goto("/gestion/tpv");
  await pagina.getByRole("link", { name: /Faltan 5,00/ }).click();
  await pagina.getByRole("button", { name: "Efectivo", exact: true }).click();
  await pagina.getByRole("button", { name: /^Cobrar 5,00/ }).click();
  await expect(pagina.getByRole("heading", { name: "Cobrado" })).toBeVisible();
  await pagina.goto("/gestion");
  await expect(pagina.getByTestId("tarjeta-Pendientes de cobro")).toHaveText("0");
});

test("factura con datos de la clienta, en la serie F", async () => {
  await pagina.goto("/gestion/tpv");
  await anadir("Pecho caballero");
  await pagina.getByLabel("Quiere factura con sus datos").check();
  await pagina.getByLabel("Nombre para la factura").fill("Juan Ruiz");
  await pagina.getByLabel("NIF para la factura").fill("123");
  await pagina.getByLabel("Dirección para la factura").fill("Calle Luna 3");
  await formaDePago("Tarjeta").click();
  await pagina.getByRole("button", { name: /^Cobrar 12,00/ }).click();
  await expect(alerta(pagina)).toHaveText("Revisa el NIF de la factura.");
  await pagina.getByLabel("NIF para la factura").fill("X1234567L");
  await pagina.getByRole("button", { name: /^Cobrar 12,00/ }).click();
  const ticket = pagina.getByLabel("Ticket");
  await expect(ticket).toContainText(`F${anio}-000001`);
  await expect(ticket).toContainText("Juan Ruiz");
  await expect(ticket).toContainText("NIF X1234567L");
});

test("devolución: rectificativa en negativo y el efectivo sale de la caja", async () => {
  await pagina.goto("/gestion/mas/facturacion");
  await expect(pagina.getByText(/Registro de facturación íntegro: 4 registros encadenados/)).toBeVisible();
  await pagina.getByRole("link", { name: new RegExp(`T${anio}-000001`) }).click();
  await pagina.getByText("Devolver esta venta…").click();
  await pagina.getByLabel("Cómo se devuelve el dinero").selectOption("efectivo");
  await pagina.getByLabel("Motivo").fill("Se equivocó de servicio");
  await pagina.getByRole("button", { name: "Hacer la devolución" }).click();
  await expect(pagina.getByRole("heading", { name: `R${anio}-000001` })).toBeVisible();
  const ticket = pagina.getByLabel("Ticket");
  await expect(ticket).toContainText("FACTURA RECTIFICATIVA");
  await expect(ticket).toContainText(`Rectifica a: T${anio}-000001`);
  await expect(ticket).toContainText(/TOTAL\s+-5,00 €/);
  await pagina.goto("/gestion/mas/facturacion");
  await expect(pagina.getByText(/Registro de facturación íntegro: 5 registros encadenados/)).toBeVisible();
});

test("caja: salida de efectivo y cierre con descuadre", async () => {
  await pagina.goto("/gestion/caja");
  // 50 de fondo + 5 (Axilas) + 5 (lo que se debía) − 5 (devolución) = 55.
  await expect(pagina.getByTestId("efectivo-esperado")).toHaveText("55,00 €");
  await teclear("Importe del movimiento", 1000);
  await pagina.getByLabel("Motivo").fill("Compra de algodón");
  await pagina.getByRole("button", { name: "Anotar salida" }).click();
  await expect(pagina.getByTestId("efectivo-esperado")).toHaveText("45,00 €");
  await teclear("Efectivo contado", 4400);
  await expect(pagina.getByTestId("diferencia")).toHaveText("Faltan 1,00 €.");
  await pagina.getByRole("button", { name: "Cerrar caja" }).click();
  await expect(pagina.getByText(/Caja cerrada con faltante de 1,00\s€/)).toBeVisible();
  await expect(pagina.getByRole("heading", { name: "Abrir caja" })).toBeVisible();
});

test("el registro de actividad recoge cobros, caja y devoluciones", async () => {
  await pagina.goto("/gestion/mas/configuracion/actividad");
  for (const accion of ["Cobró una venta", "Cobró algo pendiente", "Devolvió una venta", "Abrió la caja", "Cerró la caja", "Sacó efectivo de la caja"]) {
    await expect(pagina.getByRole("row").filter({ hasText: accion }).first()).toBeVisible();
  }
});
