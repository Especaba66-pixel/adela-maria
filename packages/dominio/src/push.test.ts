import { createDecipheriv, createECDH, createHmac, createPublicKey, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cabeceraVapid, cifrarPush, contenidoAviso, crearClavesPush, validarSuscripcion } from "./push";

const b = (t: string) => Buffer.from(t, "base64url");
const hmac = (k: Buffer, ...d: Buffer[]) => createHmac("sha256", k).update(Buffer.concat(d)).digest();

/** Lo que hace el móvil al recibir el aviso (RFC 8291), para comprobar que lo que mandamos se puede leer. */
function descifrar(cuerpo: Buffer, uaPrivada: Buffer, auth: Buffer): string {
  const sal = cuerpo.subarray(0, 16);
  const largo = cuerpo[20]!;
  const asPublica = cuerpo.subarray(21, 21 + largo);
  const cifrado = cuerpo.subarray(21 + largo);
  const ua = createECDH("prime256v1");
  ua.setPrivateKey(uaPrivada);
  const ikm = hmac(hmac(auth, ua.computeSecret(asPublica)), Buffer.from("WebPush: info\0"), ua.getPublicKey(), asPublica, Buffer.from([1]));
  const prk = hmac(sal, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])).subarray(0, 12);
  const d = createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(cifrado.subarray(-16));
  const claro = Buffer.concat([d.update(cifrado.subarray(0, -16)), d.final()]);
  expect(claro.at(-1)).toBe(2);
  return claro.subarray(0, -1).toString("utf8");
}

describe("notificaciones al móvil (Web Push)", () => {
  it("cifra exactamente como el ejemplo del RFC 8291", () => {
    const cuerpo = cifrarPush(
      b("V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24"),
      { p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", auth: "BTBZMqHH6r4Tts7J_aSIgg" },
      { sal: "DGv6ra1nlYgDCS1FRnbzlw", privadaEfimera: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw" },
    );
    expect(cuerpo.toString("base64url")).toBe(
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
    );
  });

  it("el móvil puede leer lo que se le manda, con tildes y emojis", () => {
    const movil = createECDH("prime256v1");
    movil.generateKeys();
    const auth = Buffer.from("0123456789abcdef");
    const texto = contenidoAviso({ titulo: "Mensaje de Lucía", texto: "¿Podemos cambiar la cita al jueves? 🙏", url: "/gestion" });
    const cuerpo = cifrarPush(texto, { p256dh: movil.getPublicKey().toString("base64url"), auth: auth.toString("base64url") });
    expect(JSON.parse(descifrar(cuerpo, movil.getPrivateKey(), auth))).toEqual({ titulo: "Mensaje de Lucía", texto: "¿Podemos cambiar la cita al jueves? 🙏", url: "/gestion" });
  });

  it("firma el envío (VAPID) de forma que el servicio de avisos lo puede comprobar", () => {
    const claves = crearClavesPush();
    const cabecera = cabeceraVapid("https://fcm.googleapis.com/fcm/send/abc", claves, "mailto:adelamaria_16@hotmail.com", new Date("2026-10-22T10:00:00Z"));
    const [, jwt, k] = cabecera.match(/^vapid t=([^,]+), k=(.+)$/)!;
    expect(k).toBe(claves.publica);
    const [h, c, f] = jwt!.split(".") as [string, string, string];
    expect(JSON.parse(b(c).toString())).toEqual({ aud: "https://fcm.googleapis.com", exp: Date.parse("2026-10-22T22:00:00Z") / 1000, sub: "mailto:adelamaria_16@hotmail.com" });
    const pub = b(claves.publica);
    const clave = createPublicKey({ format: "jwk", key: { kty: "EC", crv: "P-256", x: pub.subarray(1, 33).toString("base64url"), y: pub.subarray(33).toString("base64url") } });
    expect(verify("sha256", Buffer.from(`${h}.${c}`), { key: clave, dsaEncoding: "ieee-p1363" }, b(f))).toBe(true);
  });

  it("solo acepta suscripciones bien formadas, y por https", () => {
    const buena = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: createECDH("prime256v1").generateKeys().toString("base64url"), auth: Buffer.alloc(16).toString("base64url") };
    expect(validarSuscripcion(buena)).toBeNull();
    expect(validarSuscripcion({ ...buena, endpoint: "http://fcm.googleapis.com/x" })).not.toBeNull();
    expect(validarSuscripcion({ ...buena, endpoint: "http://127.0.0.1:8099/push/1" })).not.toBeNull();
    expect(validarSuscripcion({ ...buena, endpoint: "http://127.0.0.1:8099/push/1" }, { permitirLocal: true })).toBeNull();
    expect(validarSuscripcion({ ...buena, auth: "corto" })).not.toBeNull();
  });

  it("recorta los avisos largos y solo abre pantallas de la propia app", () => {
    const a = JSON.parse(contenidoAviso({ titulo: "Mensaje", texto: "a ".repeat(200), url: "https://otra-web.com" }));
    expect(a.texto.length).toBeLessThanOrEqual(140);
    expect(a.texto.endsWith("…")).toBe(true);
    expect(a.url).toBe("/gestion");
    expect(JSON.parse(contenidoAviso({ titulo: "x", texto: "y", url: "//otra-web.com" })).url).toBe("/gestion");
    expect(JSON.parse(contenidoAviso({ titulo: "x", texto: "y", url: "/gestion/clientas/1" })).url).toBe("/gestion/clientas/1");
  });
});
