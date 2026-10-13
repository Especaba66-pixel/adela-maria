import { describe, expect, it } from "vitest";
import { firmaValida, verificarSuscripcion } from "./whatsapp";

describe("webhook de WhatsApp", () => {
  const cuerpo = JSON.stringify({ entry: [{ changes: [] }] });
  async function firma(secreto: string, t = cuerpo) {
    const clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto || "x"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const f = new Uint8Array(await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(t)));
    return `sha256=${[...f].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }

  it("acepta solo avisos firmados con el secreto de la app", async () => {
    expect(await firmaValida("secreto", cuerpo, await firma("secreto"))).toBe(true);
    expect(await firmaValida("secreto", cuerpo, await firma("otro"))).toBe(false);
    expect(await firmaValida("secreto", `${cuerpo} `, await firma("secreto"))).toBe(false);
    expect(await firmaValida("secreto", cuerpo, null)).toBe(false);
    expect(await firmaValida("", cuerpo, await firma(""))).toBe(false);
  });

  it("responde al alta en Meta solo con el token correcto", () => {
    const url = (t: string) => new URL(`https://x/api/whatsapp?hub.mode=subscribe&hub.verify_token=${t}&hub.challenge=123`);
    expect(verificarSuscripcion(url("abc"), "abc")).toBe("123");
    expect(verificarSuscripcion(url("mal"), "abc")).toBeNull();
    expect(verificarSuscripcion(url(""), "")).toBeNull();
  });
});
