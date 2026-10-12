/** Genera la landing en dist/index.html. Uso: pnpm --filter @adela/landing build */
import { BONOS, CATEGORIAS, CONTACTO } from "@adela/db/datos";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FUENTES, construirPagina } from "./pagina";

const dist = fileURLToPath(new URL("../dist", import.meta.url));
mkdirSync(dist, { recursive: true });
writeFileSync(`${dist}/index.html`, construirPagina({ categorias: CATEGORIAS, bonos: BONOS, contacto: CONTACTO, url: process.env.LANDING_URL }));
// Tipografías junto a la página.
const require = createRequire(import.meta.url);
mkdirSync(`${dist}/fuentes`, { recursive: true });
for (const [familia, , archivo] of FUENTES) {
  const paquete = familia === "Inter" ? "@fontsource/inter" : "@fontsource/cormorant-garamond";
  copyFileSync(`${dirname(require.resolve(`${paquete}/package.json`))}/files/${archivo}`, `${dist}/fuentes/${archivo}`);
}
// GitHub Pages: servir tal cual, sin procesar.
writeFileSync(`${dist}/.nojekyll`, "");
console.log(`Landing generada en ${dist}/index.html`);
if (!CONTACTO.whatsapp) console.warn("Aviso: falta el WhatsApp del centro; la página no muestra botones de cita.");
