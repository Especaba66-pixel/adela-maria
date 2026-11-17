import { expect, test, type Page } from "@playwright/test";
import { diaMadrid, registrarTpv } from "./ayudas";

/**
 * Fase 4: proveedor, productos, compra que entra en el stock, venta en el TPV que lo descuenta y aviso de stock bajo,
 * gastos con su IVA y la descarga para la gestoría. Va después de tpv.spec.ts y vales-y-bonos.spec.ts (caja abierta,
 * IVA y datos fiscales puestos).
 */
test.describe.configure({ mode: "serial" });

let pagina: Page;
test.beforeAll(async ({ browser }) => {
  pagina = await browser.newPage();
  await registrarTpv(pagina);
});
test.afterAll(async () => pagina.close());

test("se da de alta el proveedor", async () => {
  await pagina.goto("/gestion/mas/proveedores");
  const form = pagina.getByRole("form", { name: "Nuevo proveedor" });
  await form.getByLabel("Nombre").fill("Cosmética Levante");
  await form.getByLabel(/NIF/).fill("B12345678");
  await form.getByRole("button", { name: "Añadir proveedor" }).click();
  await expect(pagina.getByText("«Cosmética Levante» añadido.")).toBeVisible();
  await expect(pagina.getByRole("region", { name: "Cosmética Levante" })).toContainText("NIF B12345678");
});

test("y los productos: uno para vender, con aviso al quedar 1, y otro de cabina", async () => {
  await pagina.goto("/gestion/mas/stock");
  await pagina.getByText("Añadir un producto").click();
  const form = pagina.getByRole("form", { name: "Nuevo producto" });
  await form.getByLabel("Nombre").fill("Sérum vitamina C");
  await form.getByLabel(/Proveedor/).selectOption({ label: "Cosmética Levante" });
  await form.getByLabel(/Precio de venta/).fill("29,90");
  await form.getByLabel("IVA (%)").fill("21");
  await form.getByLabel("Avisar cuando queden").fill("1");
  await form.getByRole("button", { name: "Añadir producto" }).click();
  await expect(pagina.getByText("«Sérum vitamina C» añadido.")).toBeVisible();

  await form.getByLabel("Nombre").fill("Cera tibia");
  await form.getByLabel("Para qué es").selectOption("cabina");
  await form.getByRole("button", { name: "Añadir producto" }).click();
  await expect(pagina.getByText("«Cera tibia» añadido.")).toBeVisible();
  await expect(pagina.getByTestId("stock-Sérum vitamina C")).toHaveText("0reponer");
});

test("una compra entra en el stock y queda en los gastos", async () => {
  await pagina.getByRole("link", { name: "Registrar una compra" }).click();
  const compra = pagina.getByRole("form", { name: "Compra" });
  await compra.getByLabel("Proveedor").selectOption({ label: "Cosmética Levante" });
  await compra.getByLabel("Nº de factura").fill("F-2026-118");
  const linea = compra.getByRole("group", { name: "Línea 1" });
  await linea.getByLabel("Producto").selectOption({ label: "Sérum vitamina C" });
  await linea.getByLabel("Cantidad").fill("3");
  await linea.getByLabel(/Coste/).fill("12,00");
  await expect(pagina.getByTestId("total-compra")).toContainText("Total 43,56 €");
  await compra.getByRole("button", { name: "Registrar compra" }).click();
  await expect(pagina.getByText(/Compra registrada por 43,56\s€/)).toBeVisible();
  await expect(pagina.getByTestId("stock-Sérum vitamina C")).toHaveText("3");
});

test("vender dos en el TPV los descuenta, y salta el aviso de stock bajo", async () => {
  await pagina.goto("/gestion/tpv");
  const productos = pagina.getByRole("group", { name: "Productos" });
  await expect(productos).toContainText("quedan 3");
  await productos.getByRole("button", { name: /^Sérum vitamina C/ }).click();
  await productos.getByRole("button", { name: /^Sérum vitamina C/ }).click();
  await expect(pagina.getByTestId("total")).toHaveText("59,80 €");
  await pagina.getByRole("group", { name: "Forma de pago" }).getByRole("button", { name: "Tarjeta", exact: true }).click();
  await pagina.getByRole("button", { name: /^Cobrar 59,80/ }).click();
  await expect(pagina.getByLabel("Ticket")).toContainText("Sérum vitamina C");

  await pagina.goto("/gestion");
  await expect(pagina.getByTestId("tarjeta-Stock bajo")).toHaveText("1");
  await expect(pagina.getByText("Hay que reponer: Sérum vitamina C (quedan 1).")).toBeVisible();
  await pagina.goto("/gestion/mas/stock");
  await expect(pagina.getByTestId("stock-Sérum vitamina C")).toContainText("1");
  await expect(pagina.getByTestId("stock-Sérum vitamina C")).toContainText("reponer");
});

test("la ficha del producto enseña su historial, y un recuento corrige la diferencia", async () => {
  await pagina.getByRole("link", { name: "Sérum vitamina C" }).click();
  await expect(pagina.getByText(/Compra/).first()).toBeVisible();
  await expect(pagina.getByText(/Venta/).first()).toBeVisible();
  const recuento = pagina.getByRole("form", { name: "Recuento" });
  await recuento.getByLabel("Hay ahora").fill("4");
  await recuento.getByRole("button", { name: "Anotar recuento" }).click();
  await expect(pagina.getByText("Recuento anotado (+3).")).toBeVisible();
  await expect(pagina.getByTestId("stock-actual")).toHaveText("4");
});

test("los gastos del trimestre, con su IVA, y la descarga para la gestoría", async () => {
  await pagina.goto("/gestion/mas/gastos");
  await pagina.getByText("Anotar un gasto").click();
  const form = pagina.getByRole("form", { name: "Nuevo gasto" });
  await form.getByLabel("Concepto").fill("Luz de octubre");
  // Por defecto sale «Material del centro» (lo más habitual); la luz va a suministros.
  await expect(form.getByLabel("Tipo de gasto")).toHaveValue("material");
  await form.getByLabel("Tipo de gasto").selectOption("suministros");
  await form.getByLabel(/Total pagado/).fill("121");
  await form.getByRole("button", { name: "Anotar gasto" }).click();
  await expect(pagina.getByText("Gasto «Luz de octubre» anotado.")).toBeVisible();
  // 43,56 de la compra + 121 de la luz; IVA soportado 7,56 + 21.
  await expect(pagina.getByTestId("total-gastos")).toHaveText("164,56 €");
  await expect(pagina.getByTestId("iva-soportado")).toHaveText("28,56 €");

  const [descarga] = await Promise.all([pagina.waitForEvent("download"), pagina.getByRole("link", { name: /Descargar el trimestre/ }).click()]);
  expect(descarga.suggestedFilename()).toMatch(/^adela-maria-\d{4}-T[1-4]\.csv$/);
  const contenido = await (await descarga.createReadStream()).toArray();
  const texto = Buffer.concat(contenido).toString("utf8");
  expect(texto).toContain("Luz de octubre");
  expect(texto).toContain("F-2026-118;Cosmética Levante;B12345678");
  expect(texto).toContain("FACTURAS EMITIDAS");
});

test("el stock del mes para la asesoría: lo que había, entró, salió y queda, con su valor", async () => {
  await pagina.goto("/gestion/mas/stock");
  const form = pagina.getByRole("form", { name: "Stock para la asesoría" });
  await form.getByLabel(/Stock del mes/).fill(diaMadrid(0).slice(0, 7));
  const [descarga] = await Promise.all([pagina.waitForEvent("download"), form.getByRole("button", { name: "Descargar" }).click()]);
  expect(descarga.suggestedFilename()).toMatch(/^adela-maria-stock-\d{4}-\d{2}\.csv$/);
  const texto = Buffer.concat(await (await descarga.createReadStream()).toArray()).toString("utf8");
  // Empezó en 0; entraron 3 (compra), salieron 2 (venta), un recuento sumó 3 y quedan 4, a 12 € cada uno.
  expect(texto).toContain("Existencias al empezar");
  expect(texto).toContain("Sérum vitamina C;Para vender;;Cosmética Levante;0;3;2;0;0;3;4;12,00;48,00");
  expect(texto).toContain("Valor total del stock al acabar el mes");
});

test("con el correo de la asesoría, Stock y Gastos abren el correo ya redactado", async () => {
  await pagina.goto("/gestion/mas/stock");
  await expect(pagina.getByText(/pon el correo de la asesoría/)).toBeVisible();
  await pagina.goto("/gestion/mas/configuracion/centro");
  await pagina.getByLabel("Correo de la asesoría").fill("gestoria@asesoria");
  await pagina.getByRole("button", { name: "Guardar" }).click();
  await expect(pagina.getByRole("alert").filter({ hasText: "Revisa el correo de la asesoría" })).toBeVisible();
  await pagina.getByLabel("Correo de la asesoría").fill("Gestoria@Ejemplo.es");
  await pagina.getByRole("button", { name: "Guardar" }).click();
  await expect(pagina.getByText("Guardado. Ya se ve en la web de clientas.")).toBeVisible();
  await pagina.goto("/gestion/mas/stock");
  const enlace = await pagina.getByRole("link", { name: "2. Escribir a la asesoría" }).getAttribute("href");
  expect(enlace).toContain("mailto:gestoria%40ejemplo.es?subject=Stock%20de%20");
  await pagina.goto("/gestion/mas/gastos");
  expect(await pagina.getByRole("link", { name: "Escribir a la asesoría" }).getAttribute("href")).toContain("mailto:gestoria%40ejemplo.es?subject=");
});

test("los servicios y ventas del día, en pantalla y en Excel (día y mes) para la asesoría", async () => {
  await pagina.goto("/gestion/mas/informes");
  await pagina.getByRole("link", { name: "Servicios por día" }).click();
  await expect(pagina.getByTestId("total-dia")).toContainText("Total del día:");
  await expect(pagina.getByRole("cell", { name: /Sérum vitamina C/ }).first()).toBeVisible();

  const [dia] = await Promise.all([pagina.waitForEvent("download"), pagina.getByRole("link", { name: "Descargar este día (Excel)" }).click()]);
  expect(dia.suggestedFilename()).toMatch(/^adela-maria-servicios-\d{4}-\d{2}-\d{2}\.csv$/);
  const textoDia = Buffer.concat(await (await dia.createReadStream()).toArray()).toString("utf8");
  expect(textoDia).toContain("Fecha;Hora;Factura;Clienta;Tipo;Concepto;Cantidad;Base;IVA;Total;Forma de pago");
  expect(textoDia).toMatch(/;Producto;Sérum vitamina C;2;/);
  expect(textoDia).toContain("TOTAL");

  const [mes] = await Promise.all([pagina.waitForEvent("download"), pagina.getByRole("link", { name: /Descargar .* entero \(Excel\)/ }).click()]);
  expect(mes.suggestedFilename()).toMatch(/^adela-maria-servicios-\d{4}-\d{2}\.csv$/);
  const textoMes = Buffer.concat(await (await mes.createReadStream()).toArray()).toString("utf8");
  expect(textoMes).toMatch(/Total \d{4}-\d{2}-\d{2};/);

  await pagina.goto("/gestion/mas/informes/servicios?dia=2020-01-02");
  await expect(pagina.getByText("No hay ventas este día.")).toBeVisible();
});

test("Más → Asesoría: los papeles del mes en PDF y Excel, y el correo ya redactado", async () => {
  await pagina.goto("/gestion/mas");
  await pagina.getByRole("link", { name: /Asesoría/ }).click();
  await expect(pagina.getByRole("heading", { level: 1 })).toContainText("Asesoría");
  // Por defecto sale el mes pasado; aquí se mira el actual, que es el que tiene ventas.
  const mes = diaMadrid(0).slice(0, 7);
  await pagina.goto(`/gestion/mas/asesoria?mes=${mes}`);
  for (const [clave, nombre] of [
    ["servicios", /^adela-maria-servicios-\d{4}-\d{2}\.pdf$/],
    ["stock", /^adela-maria-stock-\d{4}-\d{2}\.pdf$/],
    ["trimestre", /^adela-maria-trimestre-\d{4}-T[1-4]\.pdf$/],
  ] as const) {
    const tarjeta = pagina.getByRole("listitem").filter({ has: pagina.getByRole("heading", { name: clave === "trimestre" ? /Trimestre/ : clave === "stock" ? /Stock de/ : /Servicios y ventas/ }) });
    const [descarga] = await Promise.all([pagina.waitForEvent("download"), tarjeta.getByRole("link", { name: "Descargar PDF" }).click()]);
    expect(descarga.suggestedFilename()).toMatch(nombre);
    const bytes = Buffer.concat(await (await descarga.createReadStream()).toArray());
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1500);
    await descarga.saveAs(test.info().outputPath(descarga.suggestedFilename()));
  }
  const correo = await pagina.getByRole("link", { name: "Escribir a la asesoría" }).getAttribute("href");
  expect(correo).toContain("mailto:gestoria%40ejemplo.es?subject=Documentaci%C3%B3n%20de%20");
  expect(decodeURIComponent(correo!)).toContain(`adela-maria-servicios-${mes}.pdf`);
});

test("el registro de actividad recoge compras y gastos", async () => {
  await pagina.goto("/gestion/mas/configuracion/actividad");
  for (const accion of ["Añadió un proveedor", "Añadió un producto", "Registró una compra", "Hizo un recuento de stock", "Anotó un gasto"]) {
    await expect(pagina.getByRole("row").filter({ hasText: accion }).first()).toBeVisible();
  }
});

test("una compra con descuento del pedido se anota por el total exacto de la factura", async () => {
  await pagina.goto("/gestion/mas/stock/compra");
  const compra = pagina.getByRole("form", { name: "Compra" });
  await compra.getByLabel("Proveedor").selectOption({ label: "Cosmética Levante" });
  await compra.getByLabel("Nº de factura").fill("F-2026-131");
  const linea = compra.getByRole("group", { name: "Línea 1" });
  await linea.getByLabel("Producto").selectOption({ label: "Cera tibia" });
  await linea.getByLabel("Cantidad").fill("2");
  await linea.getByLabel(/Coste/).fill("5,00");
  // 10,00 € menos 1,00 € de descuento: base 9,00 €; el IVA calculado es 1,89 €, la factura dice 1,90 €.
  await compra.getByLabel(/Descuento del pedido/).fill("1,00");
  await expect(pagina.getByTestId("total-compra")).toContainText("Total 10,89 €");
  await compra.getByLabel("Total de la factura (€)").fill("20,00");
  await expect(compra.getByText(/no cuadra/)).toBeVisible();
  await compra.getByLabel("Total de la factura (€)").fill("10,90");
  await expect(pagina.getByTestId("total-compra")).toContainText("Base 9,00 € · IVA 1,90 € · Total 10,90 €");
  await compra.getByRole("button", { name: "Registrar compra" }).click();
  await expect(pagina.getByText(/Compra registrada por 10,90\s€/)).toBeVisible();
});

test("los productos de Arganour vienen cargados, con su precio de venta y su stock", async () => {
  await pagina.goto("/gestion/mas/stock");
  await expect(pagina.getByTestId("stock-D-Glow - Crema facial iluminadora")).toHaveText("3");
  await expect(pagina.getByTestId("stock-Agua micelar")).toHaveText("2");
});
