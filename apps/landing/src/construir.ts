/** Genera la landing en dist/index.html. Uso: pnpm --filter @adela/landing build */
import { BONOS, CATEGORIAS, CONTACTO, PRODUCTOS_VENTA } from "@adela/db/datos";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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
/** Medidas de un JPEG (para reservar su hueco y que la página no salte al cargar las fotos). */
function medidasJpeg(ruta: string): { ancho?: number; alto?: number } {
  const b = readFileSync(ruta);
  let i = 2;
  while (i + 9 < b.length && b[i] === 0xff) {
    const marca = b[i + 1]!;
    if (marca >= 0xc0 && marca <= 0xc3) return { alto: b.readUInt16BE(i + 5), ancho: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return {};
}
const trabajos = TIPOS.map(([carpeta, titulo]) => {
  const ruta = `${publico}/trabajos/${carpeta}`;
  const fotos = existsSync(ruta) ? readdirSync(ruta).filter((f) => /\.(jpe?g|webp|png)$/i.test(f)).sort() : [];
  return { titulo, fotos: fotos.map((f, i) => ({
      archivo: `trabajos/${carpeta}/${f}`,
      alt: `${titulo}: trabajo ${i + 1} de Adela María`,
      ...(/\.jpe?g$/i.test(f) ? medidasJpeg(`${ruta}/${f}`) : {}),
    })) };
});
writeFileSync(
  `${dist}/index.html`,
  construirPagina({ categorias: CATEGORIAS, bonos: BONOS, productos: PRODUCTOS_VENTA, contacto: CONTACTO, trabajos, reservasApi: process.env.RESERVAS_URL || CONTACTO.reservas, url: process.env.LANDING_URL }),
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
// Dominio propio (GitHub Pages lo lee de este archivo).
if (process.env.DOMINIO) writeFileSync(`${dist}/CNAME`, `${process.env.DOMINIO}\n`);
console.log(`Landing generada en ${dist}/index.html`);
if (!CONTACTO.whatsapp) console.warn("Aviso: falta el WhatsApp del centro; la página no muestra botones de cita.");
