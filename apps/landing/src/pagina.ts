/**
 * Landing del centro: una sola página estática, sin servidor ni base de datos (alojamiento gratuito).
 * Se genera a partir de las mismas tarifas que usa la app, para que nunca haya dos versiones distintas.
 * Las clientas piden cita por WhatsApp con el mensaje ya escrito.
 */
import type { TarifaBono, TarifaCategoria } from "@adela/db/datos";
import { enlaceWhatsapp, formatearEuros, normalizarTelefono } from "@adela/dominio";

export interface DatosLanding {
  categorias: TarifaCategoria[];
  bonos: TarifaBono[];
  contacto: { whatsapp: string | null; direccion: string | null; horario: string; instagram?: string | null };
  /** Dirección pública de la página, para las etiquetas de redes sociales. */
  url?: string;
}

/** Subtítulo de cada categoría, como en las hojas de tarifas. */
const PREGUNTA: Record<string, string> = {
  Faciales: "¿Qué necesita tu piel?",
  Depilación: "¿Qué vello necesitas eliminar?",
};

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function duracionTexto(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const precioTexto = (centimos?: number) => (centimos === undefined ? "Consultar" : formatearEuros(centimos).replace(",00", ""));

export function construirPagina(d: DatosLanding): string {
  // Solo letras, números, puntos y guiones bajos: así no puede romper el enlace.
  const instagram = d.contacto.instagram && /^[A-Za-z0-9._]{1,30}$/.test(d.contacto.instagram) ? d.contacto.instagram : null;
  const telefono = d.contacto.whatsapp ? normalizarTelefono(d.contacto.whatsapp) : null;
  if (d.contacto.whatsapp && !telefono) throw new Error(`El WhatsApp del centro no es válido: ${d.contacto.whatsapp}`);

  const enlaceCita = (tratamiento?: string) =>
    telefono
      ? esc(
          enlaceWhatsapp(
            telefono,
            tratamiento ? `Hola, me gustaría pedir cita para «${tratamiento}». ` : "Hola, me gustaría pedir cita. ",
          ),
        )
      : null;

  const botonCita = (tratamiento: string) => {
    const enlace = enlaceCita(tratamiento);
    return enlace
      ? `<a class="boton boton-secundario" href="${enlace}" target="_blank" rel="noopener" aria-label="Pedir cita por WhatsApp: ${esc(tratamiento)}">Pedir cita</a>`
      : "";
  };

  const categorias = d.categorias
    .filter((c) => c.tratamientos.length > 0)
    .map(
      (c) => `
      <section class="categoria" aria-labelledby="cat-${esc(c.nombre)}">
        <h3 id="cat-${esc(c.nombre)}">${esc(c.nombre)}</h3>
        ${PREGUNTA[c.nombre] ? `<p class="pregunta">${esc(PREGUNTA[c.nombre]!)}</p>` : ""}
        <ul class="lista">
          ${c.tratamientos
            .map(
              (t) => `
          <li class="tratamiento">
            <div>
              <div class="nombre">${esc(t.nombre)}</div>
              <div class="detalle">${t.duracionMinutos ? `${duracionTexto(t.duracionMinutos)} · ` : ""}<strong>${precioTexto(t.precioCentimos)}</strong></div>
            </div>
            ${botonCita(t.nombre)}
          </li>`,
            )
            .join("")}
        </ul>
      </section>`,
    )
    .join("");

  const bonos = d.bonos
    .map(
      (b) => `
          <li class="bono">
            <div class="bono-sesiones">${b.sesiones}</div>
            <div>
              <div class="nombre">${esc(b.nombre)}</div>
              <div class="detalle">Para cualquier tratamiento facial · adaptados a tu piel</div>
            </div>
            <div class="bono-precio">${precioTexto(b.precioCentimos)}</div>
          </li>`,
    )
    .join("");

  const ctaPrincipal = enlaceCita()
    ? `<a class="boton boton-principal" href="${enlaceCita()}" target="_blank" rel="noopener">Pedir cita por WhatsApp</a>`
    : `<p class="pronto">Muy pronto podrás pedir cita por WhatsApp desde aquí.</p>`;

  const descripcion = "Centro de belleza holística: tratamientos faciales y depilación. Consulta precios y pide tu cita por WhatsApp.";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Adela María · Belleza holística</title>
<meta name="description" content="${esc(descripcion)}">
<meta name="theme-color" content="#fffdf9">
<meta property="og:title" content="Adela María · Belleza holística">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:type" content="website">
${d.url ? `<meta property="og:url" content="${esc(d.url)}">\n<link rel="canonical" href="${esc(d.url)}">` : ""}
<link rel="preload" href="fuentes/cormorant-garamond-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
<style>${ESTILOS}</style>
</head>
<body>
<header class="cabecera">
  <div class="contenedor cabecera-fila">
    <a href="#inicio" class="marca" aria-label="Adela María · Belleza holística">
      <span class="marca-nombre">Adela María</span>
      <span class="marca-lema">Belleza holística</span>
    </a>
    ${enlaceCita() ? `<a class="boton boton-principal boton-pequeno" href="${enlaceCita()}" target="_blank" rel="noopener">Pedir cita</a>` : ""}
  </div>
</header>

<main id="inicio">
  <section class="portada">
    <div class="contenedor">
      <h1>Tu momento de cuidado</h1>
      <p class="entrada">Tratamientos faciales y depilación pensados para ti. Elige lo que te apetece y escríbenos: te confirmamos la hora por WhatsApp.</p>
      ${ctaPrincipal}
    </div>
  </section>

  <section id="tratamientos" class="contenedor bloque" aria-labelledby="titulo-tratamientos">
    <h2 id="titulo-tratamientos">Tratamientos</h2>
    ${categorias}
  </section>

  ${
    d.bonos.length
      ? `<section id="bonos" class="contenedor bloque" aria-labelledby="titulo-bonos">
    <h2 id="titulo-bonos">Bonos faciales</h2>
    <p class="nota-centrada">Adaptados a las necesidades de tu piel. <strong>No caducan.</strong></p>
    <ul class="lista">${bonos}
    </ul>
  </section>`
      : ""
  }

  <section id="regalo" class="contenedor bloque" aria-labelledby="titulo-regalo">
    <h2 id="titulo-regalo">Tarjeta regalo</h2>
    <p class="nota-centrada">Regala un momento de cuidado: elige el importe y te preparamos la tarjeta, válida para cualquier tratamiento. <strong>No caduca.</strong></p>
    ${
      telefono
        ? `<div class="centrado"><a class="boton boton-secundario" href="${esc(enlaceWhatsapp(telefono, "Hola, me gustaría una tarjeta regalo de "))}" target="_blank" rel="noopener">Pedir una tarjeta regalo</a></div>`
        : ""
    }
  </section>

  <section id="cita" class="contenedor bloque" aria-labelledby="titulo-cita">
    <h2 id="titulo-cita">Cómo pedir cita</h2>
    <ol class="pasos">
      <li><span>1</span>Elige tu tratamiento.</li>
      <li><span>2</span>Pulsa «Pedir cita» y envíanos el mensaje por WhatsApp.</li>
      <li><span>3</span>Te respondemos con la hora y la dejamos confirmada.</li>
    </ol>
    <div class="centrado">${ctaPrincipal}</div>
  </section>
</main>

<footer class="pie">
  <div class="contenedor">
    <div class="marca-nombre">Adela María · Belleza holística</div>
    <p>${esc(d.contacto.horario)}</p>
    ${d.contacto.direccion ? `<p>${esc(d.contacto.direccion)}</p>` : ""}
    ${instagram ? `<p><a href="https://www.instagram.com/${instagram}/" target="_blank" rel="noopener">Síguenos en Instagram: @${instagram}</a></p>` : ""}
    ${telefono ? `<p><a href="tel:${telefono}">Llamar</a> · <a href="${enlaceCita()}" target="_blank" rel="noopener">WhatsApp</a></p>` : ""}
    <p class="legal">Esta página no recoge datos personales. Si nos escribes por WhatsApp, usaremos tu nombre y teléfono solo para gestionar tu cita.</p>
  </div>
</footer>
</body>
</html>
`;
}

/** Tipografías servidas desde la propia página (sin Google): ningún dato del visitante sale a terceros. */
export const FUENTES = [
  ["Cormorant Garamond", 500, "cormorant-garamond-latin-500-normal.woff2"],
  ["Cormorant Garamond", 600, "cormorant-garamond-latin-600-normal.woff2"],
  ["Inter", 400, "inter-latin-400-normal.woff2"],
  ["Inter", 500, "inter-latin-500-normal.woff2"],
  ["Inter", 600, "inter-latin-600-normal.woff2"],
] as const;

const ESTILOS =
  FUENTES.map(([familia, peso, archivo]) => `@font-face{font-family:"${familia}";font-weight:${peso};font-style:normal;font-display:swap;src:url(fuentes/${archivo}) format("woff2")}`).join("") +
  `
:root{--fondo:#fffdf9;--superficie:#fff;--crema:#f7f1e6;--borde:#e6dccb;--tinta:#2b2620;--suave:#6b6156;--dorado:#b08d57;--dorado-oscuro:#7a5c2e}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--fondo);color:var(--tinta);font:400 1.0625rem/1.6 Inter,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
h1,h2,h3,.marca-nombre{font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;line-height:1.15;margin:0}
a{color:var(--dorado-oscuro)}
.contenedor{max-width:46rem;margin:0 auto;padding:0 1rem}
.cabecera{position:sticky;top:0;z-index:2;background:rgba(255,253,249,.95);backdrop-filter:blur(6px);border-bottom:1px solid var(--borde)}
.cabecera-fila{display:flex;align-items:center;justify-content:space-between;gap:1rem;min-height:4.25rem}
.marca{text-decoration:none;display:flex;flex-direction:column}
.marca-nombre{font-size:1.6rem;color:var(--dorado-oscuro)}
.marca-lema{font-size:.68rem;letter-spacing:.25em;text-transform:uppercase;color:var(--dorado)}
.portada{text-align:center;padding:4rem 0 3rem;background:linear-gradient(var(--fondo),var(--crema))}
.portada h1{font-size:clamp(2.6rem,9vw,4rem)}
.entrada{color:var(--suave);font-size:1.15rem;max-width:32rem;margin:1rem auto 2rem}
.boton{display:inline-flex;align-items:center;justify-content:center;min-height:3rem;padding:0 1.4rem;border-radius:.75rem;font-weight:600;text-decoration:none;white-space:nowrap}
.boton-principal{background:var(--dorado-oscuro);color:#fff;min-height:3.5rem;padding:0 2rem;font-size:1.1rem}
.boton-principal:hover{background:var(--tinta)}
.boton-pequeno{min-height:2.75rem;padding:0 1.1rem;font-size:1rem}
.boton-secundario{border:2px solid var(--dorado);color:var(--dorado-oscuro);background:var(--superficie)}
.boton-secundario:hover{background:var(--crema)}
.boton:focus-visible{outline:3px solid var(--dorado);outline-offset:2px}
.pronto{color:var(--suave);font-style:italic}
.bloque{padding:3rem 1rem 1rem}
.bloque h2{font-size:2.4rem;text-align:center;margin-bottom:1.5rem}
.categoria{margin-bottom:2.5rem}
.categoria h3{font-size:1.9rem;color:var(--dorado-oscuro)}
.pregunta{margin:.15rem 0 .9rem;color:var(--suave);font-style:italic}
.lista{list-style:none;margin:0;padding:0;background:var(--superficie);border:1px solid var(--borde);border-radius:1rem;overflow:hidden}
.lista li{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.15rem;border-top:1px solid var(--borde)}
.lista li:first-child{border-top:0}
.nombre{font-weight:500}
.detalle{color:var(--suave);font-size:.95rem}
.detalle strong{color:var(--tinta)}
.bono{justify-content:flex-start!important}
.bono-sesiones{flex:none;width:3rem;height:3rem;border-radius:50%;background:var(--crema);color:var(--dorado-oscuro);display:flex;align-items:center;justify-content:center;font:600 1.5rem "Cormorant Garamond",serif}
.bono-precio{margin-left:auto;font-weight:600;font-size:1.15rem}
.nota-centrada{text-align:center;color:var(--suave);margin-top:-.75rem}
.pasos{list-style:none;padding:0;margin:0 0 2rem;display:grid;gap:.75rem}
.pasos li{display:flex;align-items:center;gap:1rem;background:var(--superficie);border:1px solid var(--borde);border-radius:1rem;padding:1rem}
.pasos span{flex:none;width:2.25rem;height:2.25rem;border-radius:50%;background:var(--dorado-oscuro);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600}
.centrado{text-align:center}
.pie{margin-top:3rem;background:var(--crema);border-top:1px solid var(--borde);padding:2rem 0 2.5rem;color:var(--suave)}
.pie p{margin:.35rem 0}
.legal{font-size:.85rem;margin-top:1rem!important}
@media (max-width:30rem){.lista li{padding:.85rem 1rem}.lista .boton{min-height:2.75rem;padding:0 .9rem;font-size:.95rem}}
`;
