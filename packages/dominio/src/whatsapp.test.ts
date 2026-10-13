import { describe, expect, it } from "vitest";
import {
  cuerpoPlantilla,
  dentroDeFranja,
  entenderRespuesta,
  estadoSiguiente,
  leerAjustesWhatsapp,
  leerWebhook,
  separarVariables,
  validarPlantillaMeta,
  ventanaAbierta,
} from "./whatsapp";

const webhook = (value: unknown) => ({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value }] }] });

describe("lo que llega de Meta", () => {
  it("lee estados, con el motivo del fallo", () => {
    const e = leerWebhook(
      webhook({
        statuses: [
          { id: "wamid.A", status: "delivered", timestamp: "1760000000", recipient_id: "34611223344" },
          { id: "wamid.B", status: "failed", timestamp: "1760000001", errors: [{ code: 131026, title: "Message undeliverable", error_data: { details: "No tiene WhatsApp" } }] },
          { id: "wamid.C", status: "desconocido" },
        ],
      }),
    );
    expect(e).toEqual([
      { tipo: "estado", waId: "wamid.A", estado: "entregado", cuando: new Date(1760000000000), error: null },
      { tipo: "estado", waId: "wamid.B", estado: "fallido", cuando: new Date(1760000001000), error: "No tiene WhatsApp (131026)" },
    ]);
  });

  it("lee mensajes de texto, botones pulsados y fotos", () => {
    const e = leerWebhook(
      webhook({
        contacts: [{ wa_id: "34611223344", profile: { name: "Marta" } }],
        messages: [
          { from: "34611223344", id: "wamid.1", timestamp: "1760000000", type: "text", text: { body: "Hola!" } },
          { from: "34611223344", id: "wamid.2", timestamp: "1760000000", type: "button", button: { payload: "CONFIRMAR", text: "Confirmo" }, context: { id: "wamid.X" } },
          { from: "447700900000", id: "wamid.3", timestamp: "1760000000", type: "image", image: { id: "9" } },
        ],
      }),
    );
    expect(e[0]).toMatchObject({ tipo: "mensaje", telefono: "+34611223344", nombre: "Marta", texto: "Hola!", boton: null, responde: null });
    expect(e[1]).toMatchObject({ texto: "Confirmo", boton: "CONFIRMAR", responde: "wamid.X" });
    expect(e[2]).toMatchObject({ telefono: "+447700900000", texto: "[foto]" });
  });

  it("ignora lo que no entiende", () => {
    expect(leerWebhook(null)).toEqual([]);
    expect(leerWebhook({ entry: [{ changes: [{ field: "account_update", value: {} }] }] })).toEqual([]);
  });

  it("los estados no van hacia atrás", () => {
    expect(estadoSiguiente("leido", "entregado")).toBe("leido");
    expect(estadoSiguiente("enviado", "leido")).toBe("leido");
    expect(estadoSiguiente("enviado", "fallido")).toBe("fallido");
    expect(estadoSiguiente("entregado", "fallido")).toBe("entregado");
  });
});

describe("respuestas", () => {
  it("entiende los botones, «sí», «baja» y poco más", () => {
    expect(entenderRespuesta("Confirmo", "CONFIRMAR")).toBe("confirmar");
    expect(entenderRespuesta("Cambiar cita", "CAMBIAR")).toBe("cambiar");
    expect(entenderRespuesta("Sí!", null)).toBe("confirmar");
    expect(entenderRespuesta("Sí, confirmo.", null)).toBe("confirmar");
    expect(entenderRespuesta("BAJA", null)).toBe("baja");
    expect(entenderRespuesta("No puedo ir", null)).toBe("cambiar");
    expect(entenderRespuesta("Sí pero puedo ir a las 11?", null)).toBeNull();
  });

  it("texto libre gratis durante 24 horas desde que ella escribe", () => {
    const ahora = new Date("2026-10-13T12:00:00Z");
    expect(ventanaAbierta(new Date("2026-10-12T13:00:00Z"), ahora)).toBe(true);
    expect(ventanaAbierta(new Date("2026-10-12T11:00:00Z"), ahora)).toBe(false);
    expect(ventanaAbierta(null, ahora)).toBe(false);
  });
});

describe("envío", () => {
  it("monta la plantilla con sus variables y botones, sin parámetros vacíos", () => {
    const c = cuerpoPlantilla("+34611223344", { nombre: "recordatorio_cita", idioma: "es", categoria: "utility", variables: ["nombre", "hora"], botones: true }, { nombre: "Marta" });
    expect(c).toMatchObject({ to: "34611223344", type: "template", template: { name: "recordatorio_cita", language: { code: "es" } } });
    expect(c.template.components).toEqual([
      { type: "body", parameters: [{ type: "text", text: "Marta" }, { type: "text", text: "-" }] },
      { type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: "CONFIRMAR" }] },
      { type: "button", sub_type: "quick_reply", index: "1", parameters: [{ type: "payload", payload: "CAMBIAR" }] },
    ]);
  });

  it("valida los datos de Meta", () => {
    expect(validarPlantillaMeta({ nombre: "recordatorio_cita", idioma: "es", variables: "nombre, fecha", categoria: "utility" }, ["nombre", "fecha"])).toBeNull();
    expect(validarPlantillaMeta({ nombre: "Recordatorio cita", idioma: "es", variables: "", categoria: "utility" }, [])).toMatch(/minúsculas/);
    expect(validarPlantillaMeta({ nombre: "x", idioma: "es", variables: "nombr", categoria: "utility" }, ["nombre"])).toMatch(/nombr/);
    expect(separarVariables("{nombre}, {fecha} hora")).toEqual(["nombre", "fecha", "hora"]);
  });

  it("solo envía dentro de la franja", () => {
    const a = leerAjustesWhatsapp({ recordatorios: true, desde: 600, hasta: 1200 });
    expect(a.recordatorios).toBe(true);
    expect(dentroDeFranja(a, 9 * 60 + 59)).toBe(false);
    expect(dentroDeFranja(a, 10 * 60)).toBe(true);
    expect(dentroDeFranja(a, 20 * 60)).toBe(false);
    expect(leerAjustesWhatsapp(null).recordatorios).toBe(false);
  });
});
