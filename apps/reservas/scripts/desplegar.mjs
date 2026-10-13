// Publica el servicio de reservas en Cloudflare (lo usa GitHub Actions; también vale a mano).
// Necesita CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID y RESERVAS_CLAVE en el entorno.
// Crea la base de datos la primera vez (en Europa), aplica las migraciones, carga los datos de partida, sube la
// clave de sincronización y publica. Se puede repetir sin miedo: no borra reservas.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const wrangler = (...args) => execFileSync("pnpm", ["exec", "wrangler", ...args], { encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] });
for (const v of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "RESERVAS_CLAVE"]) {
  if (!process.env[v]) throw new Error(`Falta ${v}`);
}
if (process.env.RESERVAS_CLAVE.length < 32) throw new Error("RESERVAS_CLAVE tiene que tener al menos 32 caracteres");

let bases = JSON.parse(wrangler("d1", "list", "--json"));
if (!bases.some((b) => b.name === "adela-reservas")) {
  console.log("Creando la base de datos (en Europa)…");
  wrangler("d1", "create", "adela-reservas", "--location", "weur");
  bases = JSON.parse(wrangler("d1", "list", "--json"));
}
const id = bases.find((b) => b.name === "adela-reservas").uuid;
const config = readFileSync("wrangler.jsonc", "utf8").replace(/"database_id": "[^"]*"/, `"database_id": "${id}"`);
writeFileSync("wrangler.jsonc", config);

console.log("Migraciones…");
console.log(wrangler("d1", "migrations", "apply", "adela-reservas", "--remote"));
console.log("Datos de partida (solo si el TPV aún no ha sincronizado)…");
execFileSync("pnpm", ["semilla"], { stdio: "inherit" });
wrangler("d1", "execute", "adela-reservas", "--remote", "--file", ".wrangler/semilla.sql");
console.log("Publicando…");
const salida = wrangler("deploy");
console.log(salida);
execFileSync("pnpm", ["exec", "wrangler", "secret", "put", "CLAVE_SYNC"], { input: process.env.RESERVAS_CLAVE, stdio: ["pipe", "inherit", "inherit"] });
const url = salida.match(/https:\/\/[^\s]+\.workers\.dev/)?.[0];
console.log(`\nServicio de reservas publicado en: ${url ?? "(mira la salida de arriba)"}`);
