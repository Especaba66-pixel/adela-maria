/**
 * Notificaciones al móvil (Web Push) sin depender de nadie más que los servicios de aviso de Google y Apple.
 * Cifrado del mensaje según RFC 8291 (aes128gcm) y firma del remitente según RFC 8292 (VAPID). Solo usa node:crypto.
 */
import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign, type KeyObject } from "node:crypto";

const b64u = (b: Buffer | Uint8Array) => Buffer.from(b).toString("base64url");
const deB64u = (t: string) => Buffer.from(t, "base64url");
const hmac = (clave: Buffer, ...datos: Buffer[]) => createHmac("sha256", clave).update(Buffer.concat(datos)).digest();

/** Par de claves del remitente (VAPID): la pública se le da al móvil al suscribirse; la privada firma cada envío. */
export interface ClavesPush {
  /** Punto público P-256 sin comprimir (65 bytes), en base64url. */
  publica: string;
  /** Escalar privado (32 bytes), en base64url. */
  privada: string;
}

export function crearClavesPush(): ClavesPush {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { publica: b64u(ecdh.getPublicKey()), privada: b64u(ecdh.getPrivateKey()) };
}

function clavePrivadaFirma(c: ClavesPush): KeyObject {
  const pub = deB64u(c.publica);
  return createPrivateKey({
    format: "jwk",
    key: { kty: "EC", crv: "P-256", d: c.privada, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
  });
}

/** Cabecera Authorization de VAPID para el servicio de avisos de esa suscripción (válida 12 horas). */
export function cabeceraVapid(endpoint: string, claves: ClavesPush, contacto: string, ahora = new Date()): string {
  const cabecera = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const cuerpo = b64u(
    Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(ahora.getTime() / 1000) + 12 * 3600, sub: contacto })),
  );
  const firma = sign("sha256", Buffer.from(`${cabecera}.${cuerpo}`), { key: clavePrivadaFirma(claves), dsaEncoding: "ieee-p1363" });
  return `vapid t=${cabecera}.${cuerpo}.${b64u(firma)}, k=${claves.publica}`;
}

/** Datos que da el navegador del móvil al suscribirse. */
export interface SuscripcionPush {
  endpoint: string;
  /** Clave pública del móvil (65 bytes), base64url. */
  p256dh: string;
  /** Secreto de autenticación (16 bytes), base64url. */
  auth: string;
}

/** `permitirLocal` solo en las pruebas, que reciben los avisos en un servidor de este mismo equipo. */
export function validarSuscripcion(s: Partial<SuscripcionPush>, opciones: { permitirLocal?: boolean } = {}): string | null {
  const valida = /^https:\/\/[^\s]+$/.test(s.endpoint ?? "") || (opciones.permitirLocal && /^http:\/\/127\.0\.0\.1:\d+\/[^\s]*$/.test(s.endpoint ?? ""));
  if (!s.endpoint || !valida || s.endpoint.length > 1000) return "Suscripción no válida.";
  if (!s.p256dh || deB64u(s.p256dh).length !== 65 || !s.auth || deB64u(s.auth).length !== 16) return "Suscripción no válida.";
  return null;
}

/**
 * Cifra el mensaje para un móvil (RFC 8291, un solo registro de 4096). `fijo` solo lo usan las pruebas para
 * reproducir el ejemplo del RFC: en uso normal la sal y la clave efímera son aleatorias en cada envío.
 */
export function cifrarPush(texto: string | Buffer, s: Pick<SuscripcionPush, "p256dh" | "auth">, fijo?: { sal: string; privadaEfimera: string }): Buffer {
  const uaPublica = deB64u(s.p256dh);
  const auth = deB64u(s.auth);
  const efimera = createECDH("prime256v1");
  if (fijo) efimera.setPrivateKey(deB64u(fijo.privadaEfimera));
  else efimera.generateKeys();
  const asPublica = efimera.getPublicKey();
  const compartido = efimera.computeSecret(uaPublica);
  const sal = fijo ? deB64u(fijo.sal) : randomBytes(16);

  const prkClave = hmac(auth, compartido);
  const ikm = hmac(prkClave, Buffer.from("WebPush: info\0"), uaPublica, asPublica, Buffer.from([1]));
  const prk = hmac(sal, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])).subarray(0, 12);

  const claro = Buffer.concat([Buffer.isBuffer(texto) ? texto : Buffer.from(texto, "utf8"), Buffer.from([2])]);
  if (claro.length + 16 > 4096) throw new Error("Aviso demasiado largo.");
  const cifrador = createCipheriv("aes-128-gcm", cek, nonce);
  const cifrado = Buffer.concat([cifrador.update(claro), cifrador.final(), cifrador.getAuthTag()]);
  const tamano = Buffer.alloc(4);
  tamano.writeUInt32BE(4096);
  return Buffer.concat([sal, tamano, Buffer.from([asPublica.length]), asPublica, cifrado]);
}

/** Lo que enseña el móvil. Se recorta para no llenar la pantalla de bloqueo. */
export interface AvisoPush {
  titulo: string;
  texto: string;
  /** Pantalla de la app que se abre al tocar el aviso. */
  url: string;
}

const recortar = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

export function contenidoAviso(a: AvisoPush): string {
  return JSON.stringify({ titulo: recortar(a.titulo, 60), texto: recortar(a.texto.replace(/\s+/g, " ").trim(), 140), url: /^\/gestion(\/|\?|$)/.test(a.url) ? a.url : "/gestion" });
}
