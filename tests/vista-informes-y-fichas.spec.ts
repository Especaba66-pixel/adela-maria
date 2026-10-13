import { expect, test, type Page } from "@playwright/test";
import { diaMadrid, registrarTpv } from "./ayudas";

/**
 * Fase 7: comisiones por profesional y quién atendió en el TPV; informes del mes que cuadran con caja y facturación;
 * consentimiento informado firmado con el dedo (y su aviso si falta); fotos en la ficha. Va después de las pruebas
 * que cobran (TPV, bonos, productos), para que el informe tenga de todo.
 */
test.describe.configure({ mode: "serial" });

let pagina: Page;
const euros = (t: string) => Math.round(Number(t.replace(/[^\d,-]/g, "").replace(",", ".")) * 100);
// PNG de 2×2 píxeles.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==", "base64");

test.beforeAll(async ({ browser }) => {
  pagina = await browser.newPage();
  pagina.on("dialog", (d) => d.accept());
  await registrarTpv(pagina);
});
test.afterAll(async () => pagina.close());

test("cada profesional tiene su comisión", async () => {
  await pagina.goto("/gestion/mas/configuracion/profesionales");
  const rocio = pagina.getByRole("region", { name: "Rocío" });
  await rocio.getByText("Editar").click();
  await rocio.getByLabel("Comisión en servicios (%)").fill("200");
  await rocio.getByRole("button", { name: "Guardar" }).click();
  await expect(rocio.getByText("La comisión es un porcentaje de 0 a 100.")).toBeVisible();
  await rocio.getByLabel("Comisión en servicios (%)").fill("20");
  await rocio.getByLabel("Comisión en productos (%)").fill("5");
  await rocio.getByRole("button", { name: "Guardar" }).click();
  await expect(rocio.getByText("Guardado.")).toBeVisible();
});

test("en el TPV se elige quién atendió, y cuenta para su comisión", async () => {
  await pagina.goto("/gestion/tpv");
  await pagina.getByRole("region", { name: "Tratamientos" }).getByRole("button", { name: /^Axilas/ }).click();
  await pagina.getByLabel("Atendió").selectOption({ label: "Rocío" });
  await pagina.getByRole("group", { name: "Forma de pago" }).getByRole("button", { name: "Tarjeta", exact: true }).click();
  await pagina.getByRole("button", { name: /^Cobrar / }).click();
  await expect(pagina.getByLabel("Ticket")).toContainText("Axilas");

  await pagina.goto("/gestion/mas/informes");
  const fila = pagina.getByRole("region", { name: "Equipo y comisiones" }).getByRole("row").filter({ hasText: "Rocío" });
  await expect(fila.getByRole("cell")).toHaveCount(6);
  const celdas = await fila.getByRole("cell").allTextContents();
  const servicios = euros(celdas[3]!);
  const productos = euros(celdas[4]!);
  expect(servicios).toBeGreaterThan(0);
  expect(euros(celdas[5]!)).toBe(Math.round(servicios * 0.2) + Math.round(productos * 0.05));
});

test("el informe del mes cuadra con la caja y la facturación", async () => {
  await pagina.goto("/gestion/mas/informes");
  await expect(pagina.getByText("Todo coincide: ventas, cobros, facturas y caja.")).toBeVisible();
  await expect(pagina.getByRole("list", { name: "Comprobaciones" }).getByRole("listitem")).toHaveCount(3);
  expect(euros((await pagina.getByTestId("total-ventas").textContent())!)).toBeGreaterThan(0);
  await expect(pagina.getByRole("region", { name: "Tratamientos" })).toContainText("Axilas");
  await expect(pagina.getByRole("region", { name: "Productos" })).toContainText("Sérum vitamina C");
  await expect(pagina.getByRole("region", { name: "Caja" })).not.toContainText("No se abrió la caja");

  const [descarga] = await Promise.all([pagina.waitForEvent("download"), pagina.getByRole("link", { name: "Descargar para Excel" }).click()]);
  expect(descarga.suggestedFilename()).toMatch(/^adela-maria-informe-\d{4}-\d{2}\.csv$/);
  const texto = Buffer.concat(await (await descarga.createReadStream()).toArray()).toString("utf8");
  expect(texto).toContain("CUADRE");
  expect(texto).not.toContain("NO COINCIDE");
  expect(texto).toContain("EQUIPO Y COMISIONES");

  await pagina.getByRole("link", { name: "‹ Mes anterior" }).click();
  await expect(pagina.getByText("Sin ventas este mes.")).toBeVisible();
});

test("si un tratamiento pide consentimiento, avisa y se firma con el dedo", async () => {
  await pagina.goto("/gestion/mas/configuracion/consentimientos");
  const modelo = pagina.getByRole("form", { name: "Consentimiento Tratamientos faciales y corporales" });
  await pagina.locator("details").evaluateAll((ds) => ds.forEach((d) => ((d as HTMLDetailsElement).open = true)));
  await modelo.getByLabel("Axilas").check();
  await modelo.getByRole("button", { name: "Guardar" }).click();
  await expect(modelo.getByText("Guardado.")).toBeVisible();

  await pagina.goto("/gestion/clientas/nueva");
  await pagina.getByLabel("Nombre").fill("Inés Vidal");
  await pagina.getByLabel("Teléfono").fill("688 12 34 56");
  await pagina.getByRole("button", { name: "Crear clienta" }).click();
  await expect(pagina.getByRole("heading", { name: "Inés Vidal" })).toBeVisible();
  await pagina.goto(`/gestion/agenda/nueva?fecha=${diaMadrid(1)}&hora=${18 * 60}`);
  await pagina.getByLabel("Buscar clienta").fill("Inés Vidal");
  await pagina.getByRole("button", { name: /Inés Vidal/ }).click();
  await pagina.locator("label").filter({ hasText: /^Axilas/ }).click();
  await pagina.getByRole("button", { name: "Guardar cita" }).click();
  await expect(pagina.getByText("Cita guardada.")).toBeVisible();
  await expect(pagina.getByText("Falta que firme «Tratamientos faciales y corporales».")).toBeVisible();

  await pagina.goto("/gestion/avisos");
  await pagina.getByRole("link", { name: "Inés Vidal tiene que firmar «Tratamientos faciales y corporales» antes de su cita." }).click();
  await expect(pagina.getByTestId("texto-consentimiento")).toContainText("Yo, Inés Vidal, solicito a Adela María");
  await pagina.getByRole("button", { name: "Firmar" }).click();
  await expect(pagina.getByText("Falta la firma.")).toBeVisible();
  const caja = (await pagina.getByTestId("firma").boundingBox())!;
  await pagina.mouse.move(caja.x + 30, caja.y + 100);
  await pagina.mouse.down();
  for (let i = 1; i <= 20; i++) await pagina.mouse.move(caja.x + 30 + i * 15, caja.y + 100 + Math.sin(i) * 40);
  await pagina.mouse.up();
  await pagina.getByRole("button", { name: "Firmar" }).click();
  await expect(pagina.getByText("Consentimiento firmado y guardado en su ficha.")).toBeVisible();
  await expect(pagina.getByRole("img", { name: "Firma de Inés Vidal" })).toBeVisible();

  await pagina.goto("/gestion/avisos");
  await expect(pagina.getByText("Inés Vidal tiene que firmar")).toHaveCount(0);
});

test("se puede retirar, y queda anotado", async () => {
  await pagina.goto("/gestion/clientas?q=Inés");
  await pagina.getByRole("link", { name: "Inés Vidal" }).click();
  await pagina.getByRole("list", { name: "Consentimientos firmados" }).getByRole("link", { name: "Tratamientos faciales y corporales" }).click();
  await pagina.getByText("Retirar este consentimiento…").click();
  await pagina.getByRole("button", { name: "Sí, retirarlo" }).click();
  await expect(pagina.getByText(/^Retirado el/)).toBeVisible();
  await pagina.goto("/gestion/avisos");
  await expect(pagina.getByText("Inés Vidal tiene que firmar «Tratamientos faciales y corporales» antes de su cita.")).toBeVisible();
});

test("fotos de antes y después en la ficha", async () => {
  await pagina.goto("/gestion/clientas?q=Inés");
  await pagina.getByRole("link", { name: "Inés Vidal" }).click();
  const form = pagina.getByRole("form", { name: "Subir foto" });
  await form.getByLabel("Foto").setInputFiles({ name: "antes.png", mimeType: "image/png", buffer: PNG });
  await form.getByLabel(/Nota/).fill("Ceja izquierda");
  await form.getByRole("button", { name: "Guardar foto" }).click();
  await expect(pagina.getByText("Foto guardada.")).toBeVisible();
  const fotos = pagina.getByRole("list", { name: "Fotos" });
  await expect(fotos.getByRole("listitem")).toHaveCount(1);
  await expect(fotos).toContainText("Antes");
  await expect(fotos).toContainText("Ceja izquierda");
  const src = await fotos.getByRole("img").getAttribute("src");
  const r = await pagina.request.get(src!);
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toMatch(/^image\//);

  await fotos.getByRole("button", { name: "Borrar" }).click();
  await expect(pagina.getByRole("list", { name: "Fotos" })).toHaveCount(0);
});
