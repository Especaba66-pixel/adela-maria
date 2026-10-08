/**
 * Cifrado irreversible de contraseñas y PIN con scrypt (incluido en Node, sin dependencias nativas).
 * Formato guardado: scrypt$N$r$p$sal$hash, en base64url.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 2 ** 15;
const R = 8;
const P = 1;
const LONGITUD = 32;

function scrypt(secreto: string, sal: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  const opciones: ScryptOptions = { N: n, r, p, maxmem: 256 * n * r };
  return new Promise((resolve, reject) =>
    scryptCb(secreto, sal, LONGITUD, opciones, (err, clave) => (err ? reject(err) : resolve(clave))),
  );
}

export async function cifrarSecreto(secreto: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scrypt(secreto, sal, N, R, P);
  return ["scrypt", N, R, P, sal.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function comprobarSecreto(secreto: string, guardado: string): Promise<boolean> {
  const partes = guardado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, sal, hash] = partes as [string, string, string, string, string, string];
  const esperado = Buffer.from(hash, "base64url");
  const obtenido = await scrypt(secreto, Buffer.from(sal, "base64url"), Number(n), Number(r), Number(p));
  return obtenido.length === esperado.length && timingSafeEqual(obtenido, esperado);
}
