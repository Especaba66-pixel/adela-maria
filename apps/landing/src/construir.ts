/** Genera la landing en dist/index.html. Uso: pnpm --filter @adela/landing build */
import { BONOS, CATEGORIAS, CONTACTO } from "@adela/db/datos";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FUENTES, construirPagina } from "./pagina";

const dist = fileURLToPath(new URL("../dist", import.meta.url));
mkdirSync(dist, { recursive: true });
const publico = fileURLToPath(new URL("../publico", import.meta.url));
// Fotos de trabajos: publico/trabajos/<tipo>/*.jpg (o .webp/.png). Se muestran en este orden.
const TIPOS: [string, string][] = [
  ["microblading", "Microblading"],
  ["maquillaje", "Maquillaje"],
  ["unas", "Uñas"],
  ["faciales", "Faciales"],
];
const trabajos = TIPOS.map(([carpeta, titulo]) => {
  const ruta = `${publico}/trabajos/${carpeta}`;
  const fotos = existsSync(ruta) ? readdirSync(ruta).filter((f) => /\.(jpe?g|webp|png)$/i.test(f)).sort() : [];
  return { titulo, fotos: fotos.map((f, i) => ({ archivo: `trabajos/${carpeta}/${f}`, alt: `${titulo}: trabajo ${i + 1} de Adela María` })) };
});
writeFileSync(
  `${dist}/index.html`,
  construirPagina({ categorias: CATEGORIAS, bonos: BONOS, contacto: CONTACTO, trabajos, url: process.env.LANDING_URL }),
);
// Tipografías junto a la página.
const require = createRequire(import.meta.url);
mkdirSync(`${dist}/fuentes`, { recursive: true });
for (const [familia, , archivo] of FUENTES) {
  const paquete = familia === "Inter" ? "@fontsource/inter" : "@fontsource/cormorant-garamond";
  copyFileSync(`${dirname(require.resolve(`${paquete}/package.json`))}/files/${archivo}`, `${dist}/fuentes/${archivo}`);
}
// Logo, iconos (generados desde infra/marca) y fotos de trabajos.
cpSync(publico, dist, { recursive: true });
// GitHub Pages: servir tal cual, sin procesar.
writeFileSync(`${dist}/.nojekyll`, "");
console.log(`Landing generada en ${dist}/index.html`);
if (!CONTACTO.whatsapp) console.warn("Aviso: falta el WhatsApp del centro; la página no muestra botones de cita.");
