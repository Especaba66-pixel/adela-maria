import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { META, RESERVAS } from "../playwright.config";
import { diaMadrid, registrarTpv } from "./ayudas";

/**
 * Fase 6: WhatsApp automático con la API oficial (Meta imitado en local). El recordatorio sale solo y la clienta
 * confirma con un botón; los estados (entregado, leído) y las respuestas llegan por el webhook al servicio de
 * Cloudflare y el TPV se los trae; baja por WhatsApp, fallos a la vista, respuesta libre y envío a un grupo.
 */
test.describe.configure({ mode: "serial" });

let pagina: Page;
const manana = diaMadrid(1);

test.beforeAll(async ({ browser }) => {
  pagina = await browser.newPage();
  pagina.on("dialog", (d) => d.accept());
  await registrarTpv(pagina);
});
test.afterAll(async () => pagina.close());

type Enviado = { id: string; to: string; type: string; template?: { name: string; components: { type: string; parameters: { text?: string; payload?: string }[] }[] }; text?: { body: string } };
const enviados = async (): Promise<Enviado[]> => (await fetch(`${META.url}/__enviados`)).json();
const enviadosA = async (telefono: string) => (await enviados()).filter((e) => e.to === telefono);

/** Meta avisa al servicio de Cloudflare, firmando con el secreto de la app. */
async function avisoDeMeta(value: unknown) {
  const cuerpo = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value }] }] });
  const firma = createHmac("sha256", META.secreto).update(cuerpo).digest("hex");
  const r = await fetch(`${RESERVAS.url}/api/whatsapp`, { method: "POST", body: cuerpo, headers: { "Content-Type": "application/json", "X-Hub-Signature-256": `sha256=${firma}` } });
  expect(r.status).toBe(200);
}
const ahoraMeta = () => String(Math.floor(Date.now() / 1000));
let wamid = 0;
const escribe = (de: string, extra: Record<string, unknown>) =>
  avisoDeMeta({ contacts: [{ wa_id: de, profile: { name: "Clienta" } }], messages: [{ from: de, id: `wamid.entrante${++wamid}`, timestamp: ahoraMeta(), ...extra }] });

const sincronizar = async () => {
  await pagina.goto("/gestion/reservas");
  await Promise.all([pagina.waitForResponse((r) => r.request().method() === "POST"), pagina.getByRole("button", { name: "Sincronizar ahora" }).click()]);
};

async function nuevaClienta(nombre: string, telefono: string) {
  await pagina.goto("/gestion/clientas/nueva");
  await pagina.getByLabel("Nombre").fill(nombre);
  await pagina.getByLabel("Teléfono").fill(telefono);
  await pagina.getByLabel(/^Avisos de sus citas/).check();
  await pagina.getByRole("button", { name: "Crear clienta" }).click();
  await expect(pagina.getByRole("heading", { name: nombre })).toBeVisible();
}

async function citaManana(nombre: string, hora: string) {
  // A última hora de la tarde: las demás pruebas llenan la mañana.
  await pagina.goto(`/gestion/agenda/nueva?fecha=${manana}&hora=${Number(hora.slice(0, 2)) * 60}`);
  await expect(pagina.getByLabel("Hora")).toHaveValue(hora);
  await pagina.getByLabel("Buscar clienta").fill(nombre);
  await pagina.getByRole("button", { name: new RegExp(nombre) }).click();
  await pagina.locator("label").filter({ hasText: /^Axilas/ }).click();
  await pagina.getByRole("button", { name: "Guardar cita" }).click();
  await expect(pagina.getByText("Cita guardada.")).toBeVisible();
  return pagina.url();
}

async function ficha(nombre: string) {
  await pagina.goto(`/gestion/clientas?q=${encodeURIComponent(nombre)}`);
  await pagina.getByRole("link", { name: nombre }).click();
  await expect(pagina.getByRole("heading", { name: nombre, level: 1 })).toBeVisible();
}

test("se conecta con Meta: se apuntan los mensajes aprobados y se enciende el envío automático", async () => {
  await pagina.goto("/gestion/mas/whatsapp");
  await expect(pagina.getByText("Conectado con WhatsApp de Meta.")).toBeVisible();
  // Abre los «Datos de Meta» de todos los mensajes.
  await pagina.locator("details").evaluateAll((ds) => ds.forEach((d) => ((d as HTMLDetailsElement).open = true)));

  const rec = pagina.getByRole("form", { name: "Meta: Recordatorio de la cita de mañana" });
  await rec.getByLabel(/Nombre en Meta/).fill("Recordatorio Cita");
  await rec.getByRole("button", { name: "Guardar datos de Meta" }).click();
  await expect(rec.getByText(/minúsculas/)).toBeVisible();
  await rec.getByLabel(/Nombre en Meta/).fill("recordatorio_cita");
  await rec.getByLabel(/Variables/).fill("nombre, servicios, fecha, hora");
  await rec.getByLabel(/botones/).check();
  await rec.getByRole("button", { name: "Guardar datos de Meta" }).click();
  await expect(rec.getByText("Guardado: ya se puede enviar desde la app.")).toBeVisible();

  const cum = pagina.getByRole("form", { name: "Meta: Felicitación de cumpleaños" });
  await cum.getByLabel(/Nombre en Meta/).fill("felicitacion");
  await cum.getByLabel(/Variables/).fill("nombre");
  await cum.getByRole("button", { name: "Guardar datos de Meta" }).click();
  await expect(cum.getByText("Guardado: ya se puede enviar desde la app.")).toBeVisible();

  const auto = pagina.getByRole("form", { name: "Envío automático" });
  await auto.getByLabel(/Recordatorios/).check();
  await auto.getByLabel("Enviar desde las").fill("00:00");
  await auto.getByLabel("hasta las").fill("23:59");
  await auto.getByRole("button", { name: "Guardar" }).click();
  await expect(auto.getByText("Guardado.")).toBeVisible();
});

let urlCita: string;

test("el recordatorio sale solo y la clienta confirma con un botón", async () => {
  await nuevaClienta("Elena Soto", "666 11 22 33");
  urlCita = await citaManana("Elena Soto", "19:00");
  await sincronizar();

  const [rec] = (await enviadosA("34666112233")).filter((e) => e.template?.name === "recordatorio_cita");
  expect(rec).toBeTruthy();
  expect(rec!.template!.components[0]!.parameters.map((p) => p.text)).toEqual(["Elena", "Axilas", expect.stringMatching(/\d/), expect.stringMatching(/^\d\d:\d\d$/)]);
  expect(rec!.template!.components.slice(1).map((c) => c.parameters[0]!.payload)).toEqual(["CONFIRMAR", "CAMBIAR"]);

  // Una segunda sincronización no lo repite.
  await sincronizar();
  expect((await enviadosA("34666112233")).filter((e) => e.template?.name === "recordatorio_cita")).toHaveLength(1);

  await ficha("Elena Soto");
  await expect(pagina.getByTestId("estado-envio").first()).toHaveText("Enviado");

  // Meta avisa de que llegó y se leyó; ella pulsa «Confirmar».
  await avisoDeMeta({ statuses: [{ id: rec!.id, status: "read", timestamp: ahoraMeta(), recipient_id: "34666112233" }, { id: rec!.id, status: "delivered", timestamp: ahoraMeta() }] });
  await escribe("34666112233", { type: "button", button: { payload: "CONFIRMAR", text: "Confirmar" }, context: { from: "123456", id: rec!.id } });
  await sincronizar();

  await ficha("Elena Soto");
  const lista = pagina.getByRole("list", { name: "Mensajes" });
  await expect(lista).toContainText("Elena escribió");
  await expect(lista.getByTestId("estado-envio").filter({ hasText: "Leído" })).toHaveCount(1);
  await pagina.goto(urlCita);
  await expect(pagina.getByText(/La clienta confirmó que viene/)).toBeVisible();
  const gracias = (await enviadosA("34666112233")).find((e) => e.type === "text");
  expect(gracias?.text?.body).toBe("¡Gracias, Elena! Tu cita queda confirmada. Te esperamos.");
  await pagina.goto(`/gestion/agenda?fecha=${manana}`);
  await expect(pagina.getByText("· ✓ confirmó por WhatsApp")).toBeVisible();
});

test("si escribe otra cosa, sale en el inicio y se le contesta desde la ficha", async () => {
  await escribe("34666112233", { type: "text", text: { body: "¿Puedo ir a las 11 en vez de a esa hora?" } });
  await sincronizar();
  await pagina.goto("/gestion/avisos");
  const aviso = pagina.getByRole("list", { name: "Por hacer" }).getByRole("listitem").filter({ hasText: "Elena Soto ha escrito por WhatsApp." });
  await expect(aviso).toContainText("¿Puedo ir a las 11");
  await aviso.getByRole("link", { name: "Elena Soto ha escrito por WhatsApp." }).click();
  const responder = pagina.getByRole("form", { name: "Responder por WhatsApp" });
  await responder.getByLabel("Respuesta").fill("Claro, te cambio a las 11.");
  await responder.getByRole("button", { name: "Responder" }).click();
  await expect(pagina.getByRole("list", { name: "Mensajes" })).toContainText("Claro, te cambio a las 11.");
  expect((await enviadosA("34666112233")).some((e) => e.text?.body === "Claro, te cambio a las 11.")).toBe(true);
});

test("con «BAJA» se le retiran los permisos y se le confirma", async () => {
  await escribe("34666112233", { type: "text", text: { body: "BAJA" } });
  await sincronizar();
  await ficha("Elena Soto");
  await expect(pagina.getByLabel(/^Avisos de sus citas/)).not.toBeChecked();
  await expect(pagina.getByText(/Avisos de citas: retirado \(whatsapp\)/)).toBeVisible();
  expect((await enviadosA("34666112233")).some((e) => e.text?.body.startsWith("Hecho, Elena: ya no te enviaremos mensajes automáticos."))).toBe(true);
});

test("si un envío falla, sale en el inicio con el motivo", async () => {
  await nuevaClienta("Paula Ríos", "699 99 99 99");
  await citaManana("Paula Ríos", "20:00");
  await sincronizar();
  await pagina.goto("/gestion/avisos");
  const aviso = pagina.getByRole("list", { name: "Por hacer" }).getByRole("listitem").filter({ hasText: "No se pudo enviar el recordatorio a Paula Ríos." });
  await expect(aviso).toContainText("El número no tiene WhatsApp (131026)");
  await ficha("Paula Ríos");
  await expect(pagina.getByTestId("estado-envio").first()).toHaveText("No se pudo enviar");
});

test("un aviso con mensaje aprobado se envía desde la app", async () => {
  await pagina.goto("/gestion/avisos");
  const aviso = pagina.getByRole("list", { name: "Por hacer" }).getByRole("listitem").filter({ hasText: "Hoy cumple años Rosa Marín." });
  await aviso.getByRole("button", { name: "Enviar WhatsApp" }).click();
  await expect(aviso).toHaveCount(0);
  const [f] = (await enviadosA("34655708090")).filter((e) => e.template?.name === "felicitacion");
  expect(f!.template!.components[0]!.parameters[0]!.text).toBe("Rosa");
});

test("envío a un grupo: solo a quien acepta promociones", async () => {
  await pagina.goto("/gestion/mas/whatsapp/campana");
  await pagina.locator('select[name="segmento"]').selectOption({ label: "Cumplen años este mes" });
  await pagina.locator('select[name="plantilla"]').selectOption({ label: "Felicitación de cumpleaños" });
  await pagina.getByRole("button", { name: "Ver a quién" }).click();
  await expect(pagina.getByTestId("destinatarias")).toContainText("Lucía Gómez");
  await expect(pagina.getByTestId("destinatarias")).not.toContainText("Nieves Prado");
  const antes = (await enviados()).length;
  await pagina.getByRole("button", { name: /^Enviar a \d+ clientas?$/ }).click();
  await expect(pagina.getByText(/^Enviado a \d+ clientas?\.$/)).toBeVisible();
  const nuevos = (await enviados()).slice(antes);
  expect(nuevos.map((e) => e.to)).toContain("34655102030");
  expect(nuevos.map((e) => e.to)).not.toContain("34655405060");
  await pagina.reload();
  await expect(pagina.getByRole("region", { name: "Envíos anteriores" })).toContainText("Felicitación de cumpleaños · Cumplen años este mes");
  await pagina.goto("/gestion/mas/whatsapp");
  await expect(pagina.getByTestId("envios-mes")).toContainText(/\d+ de utilidad, \d+ de marketing/);
});
