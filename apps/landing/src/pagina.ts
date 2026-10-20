/**
 * Landing del centro: una sola página estática, sin servidor ni base de datos (alojamiento gratuito).
 * Se genera a partir de las mismas tarifas que usa la app, para que nunca haya dos versiones distintas.
 * Las clientas piden cita por WhatsApp con el mensaje ya escrito.
 */
import type { TarifaBono, TarifaCategoria } from "@adela/db/datos";
import { enlaceWhatsapp, formatearEuros, normalizarTelefono } from "@adela/dominio";
import { ESTILOS_RESERVA, SCRIPT_RESERVA, bloqueReserva } from "./reserva";

export interface DatosLanding {
  categorias: TarifaCategoria[];
  bonos: TarifaBono[];
  /** Productos que se venden en el centro, con su precio (IVA incluido), en el orden en que se muestran. */
  productos?: { nombre: string; grupo: string; precioCentimos: number }[];
  /** Fotos de trabajos por tipo («Microblading», «Uñas»…), ya copiadas junto a la página. */
  trabajos?: { titulo: string; fotos: { archivo: string; alt: string; ancho?: number; alto?: number }[] }[];
  contacto: { whatsapp: string | null; direccion: string | null; horario: string; instagram?: string | null };
  /** Fotos que abren la portada, en este orden (rutas de `trabajos`); después van las demás. */
  portada?: string[];
  /** Imagen destacada bajo la portada, con el tratamiento al que invita a reservar. */
  destacado?: { archivo: string; alt: string; ancho?: number; alto?: number; tratamiento: string };
  /** Servicio de reservas por internet (Cloudflare). Sin él, se pide cita por WhatsApp. */
  reservasApi?: string | null;
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

  const api = d.reservasApi && /^https?:\/\/[^\s"'<>]+$/.test(d.reservasApi) ? d.reservasApi : null;
  const botonCita = (tratamiento: string, reservable = false) => {
    if (api && reservable) {
      return `<a class="boton boton-secundario" href="#reservar" data-reservar="${esc(tratamiento)}" aria-label="Reservar: ${esc(tratamiento)}">Reservar</a>`;
    }
    const enlace = enlaceCita(tratamiento);
    return enlace
      ? `<a class="boton boton-secundario" href="${enlace}" target="_blank" rel="noopener" aria-label="Pedir cita por WhatsApp: ${esc(tratamiento)}">Pedir cita</a>`
      : "";
  };

  const categorias = d.categorias
    .filter((c) => c.tratamientos.length > 0)
    .map(
      (c) => `
      <section class="categoria aparece" aria-labelledby="cat-${esc(c.nombre)}">
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
            ${botonCita(t.nombre, Boolean(t.duracionMinutos))}
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

  const grupos = [...new Set((d.productos ?? []).map((p) => p.grupo))];
  const idGrupo = (g: string) => `prod-${g.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const productos = grupos
    .map(
      (g) => `
      <section class="categoria aparece" aria-labelledby="${idGrupo(g)}">
        <h3 id="${idGrupo(g)}">${esc(g)}</h3>
        <ul class="lista">
          ${(d.productos ?? [])
            .filter((p) => p.grupo === g)
            .map(
              (p) => `
          <li class="tratamiento">
            <div>
              <div class="nombre">${esc(p.nombre)}</div>
              <div class="detalle"><strong>${precioTexto(p.precioCentimos)}</strong></div>
            </div>
            ${
              telefono
                ? `<a class="boton boton-secundario" href="${esc(enlaceWhatsapp(telefono, `Hola, me gustaría reservar «${p.nombre}». `))}" target="_blank" rel="noopener" aria-label="Reservar por WhatsApp: ${esc(p.nombre)}">Lo quiero</a>`
                : ""
            }
          </li>`,
            )
            .join("")}
        </ul>
      </section>`,
    )
    .join("");

  const ctaPrincipal = enlaceCita()
    ? `<a class="boton boton-principal" href="${enlaceCita()}" target="_blank" rel="noopener">Pedir cita por WhatsApp</a>`
    : `<p class="pronto">Muy pronto podrás pedir cita por WhatsApp desde aquí.</p>`;

  // Fotos de los trabajos para la portada y la cinta (una de cada tipo primero, para que se vean todos).
  const conFotos = (d.trabajos ?? []).filter((t) => t.fotos.length);
  const intercaladas = Array.from({ length: Math.max(0, ...conFotos.map((t) => t.fotos.length)) }, (_, i) => conFotos.flatMap((t) => (t.fotos[i] ? [t.fotos[i]!] : []))).flat();
  const primeras = (d.portada ?? []).flatMap((archivo) => intercaladas.filter((f) => f.archivo === archivo));
  const pase = [...primeras, ...intercaladas.filter((f) => !primeras.includes(f))].slice(0, 10);

  const destacado = d.destacado
    ? `<section class="contenedor destacado aparece" aria-label="${esc(d.destacado.alt)}">
    <img src="${esc(d.destacado.archivo)}" alt="${esc(d.destacado.alt)}"${d.destacado.ancho && d.destacado.alto ? ` width="${d.destacado.ancho}" height="${d.destacado.alto}"` : ""} decoding="async">
    <div class="centrado">${botonCita(d.destacado.tratamiento, true).replace(/>(Reservar|Pedir cita)</, ">Reservar mi diseño de cejas<")}</div>
  </section>`
    : "";

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
<link rel="icon" type="image/png" href="favicon.png">
<link rel="apple-touch-icon" href="icono.png">
<meta property="og:image" content="${esc(d.url ? `${d.url.replace(/\/$/, "")}/sello.png` : "sello.png")}">
<link rel="preload" href="fuentes/cormorant-garamond-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
<style>${ESTILOS}${ESTILOS_RESERVA}${estilosPase(pase.length)}</style>
<script>document.documentElement.classList.add("js")</script>
</head>
<body>
<header class="cabecera">
  <div class="contenedor cabecera-fila">
    <a href="#inicio" class="marca" aria-label="Adela María · Belleza holística">
      <img src="logotipo.png" alt="Adela María · Belleza holística" width="155" height="48">
    </a>
    ${
      api
        ? `<a class="boton boton-principal boton-pequeno" href="#reservar">Reservar</a>`
        : enlaceCita()
          ? `<a class="boton boton-principal boton-pequeno" href="${enlaceCita()}" target="_blank" rel="noopener">Pedir cita</a>`
          : ""
    }
  </div>
</header>

<main id="inicio">
  <section class="portada${pase.length ? " con-fotos" : ""}">
    ${pase.length ? `<div class="pase" aria-hidden="true">${pase.map((f, i) => `<img src="${esc(f.archivo)}" alt="" style="animation-delay:${i * SEGUNDOS_FOTO}s"${i ? ' loading="lazy"' : ""} decoding="async">`).join("")}</div>` : ""}
    <div class="contenedor portada-texto">
      <img class="sello aparece" src="sello.png" alt="" width="240" height="240" loading="lazy">
      <h2 class="aparece">Tu momento de cuidado</h2>
      <p class="entrada aparece">Tratamientos faciales, depilación, microblading, maquillaje y uñas, pensados para ti.</p>
    </div>
  </section>

  ${bloqueReserva(api, `<div class="centrado reserva-alternativa">${ctaPrincipal}</div>`)}

  ${destacado}



  <section id="tratamientos" class="contenedor bloque" aria-labelledby="titulo-tratamientos">
    <h2 id="titulo-tratamientos" class="aparece">Tratamientos</h2>
    ${categorias}
  </section>

  ${
    d.bonos.length
      ? `<section id="bonos" class="contenedor bloque" aria-labelledby="titulo-bonos">
    <h2 id="titulo-bonos" class="aparece">Bonos faciales</h2>
    <p class="nota-centrada">Adaptados a las necesidades de tu piel. <strong>No caducan.</strong></p>
    <ul class="lista">${bonos}
    </ul>
  </section>`
      : ""
  }

  ${
    productos
      ? `<section id="productos" class="contenedor bloque" aria-labelledby="titulo-productos">
    <h2 id="titulo-productos" class="aparece">Productos</h2>
    <p class="nota-centrada">Cosmética facial y aceites para seguir cuidándote en casa. Están a la venta en el centro: pregúntanos cuál va mejor con tu piel.</p>
    ${productos}
  </section>`
      : ""
  }

  ${
    d.trabajos?.some((t) => t.fotos.length)
      ? `<section id="trabajos" class="contenedor bloque" aria-labelledby="titulo-trabajos">
    <h2 id="titulo-trabajos" class="aparece">Nuestros trabajos</h2>
    <div class="cinta" aria-hidden="true"><div class="cinta-pista">${[...pase, ...pase].map((f) => `<img src="${esc(f.archivo)}" alt="" loading="lazy" decoding="async">`).join("")}</div></div>
    ${d.trabajos
      .filter((t) => t.fotos.length)
      .map(
        (t) => `<h3 class="categoria aparece">${esc(t.titulo)}</h3>
    <div class="galeria aparece">${t.fotos.map((f) => `<img src="${esc(f.archivo)}" alt="${esc(f.alt)}"${f.ancho && f.alto ? ` width="${f.ancho}" height="${f.alto}"` : ""} loading="lazy" decoding="async">`).join("")}</div>`,
      )
      .join("\n    ")}
  </section>`
      : ""
  }

  <section id="maquillaje" class="contenedor bloque" aria-labelledby="titulo-maquillaje">
    <h2 id="titulo-maquillaje" class="aparece">Prepara tu piel para un maquillaje perfecto</h2>
    <ol class="preparacion aparece">
      <li><strong>10 días antes</strong> Higiene facial profunda, ideal para una piel limpia y luminosa.</li>
      <li><strong>3 días antes</strong> Exfoliación suave y mucha hidratación. Evita productos nuevos y no uses labiales permanentes o de larga duración.</li>
      <li><strong>2 días antes</strong> Bebe 2 litros de agua y duerme 8 horas. Aplica bálsamo hidratante en los labios varias veces al día.</li>
      <li><strong>1 día antes</strong> No depiles cejas ni labio. Hidratante y contorno de ojos. Mucho bálsamo en los labios, sin labial permanente.</li>
      <li><strong>El día D</strong> Piel limpia e hidratada, sin exfoliar. Labios exfoliados y mucho bálsamo hidratante.</li>
    </ol>
  </section>

  <section id="regalo" class="contenedor bloque" aria-labelledby="titulo-regalo">
    <h2 id="titulo-regalo" class="aparece">Tarjeta regalo</h2>
    <p class="nota-centrada">Regala un momento de cuidado: elige el importe y te preparamos la tarjeta, válida para cualquier tratamiento. <strong>No caduca.</strong></p>
    ${
      telefono
        ? `<div class="centrado"><a class="boton boton-secundario" href="${esc(enlaceWhatsapp(telefono, "Hola, me gustaría una tarjeta regalo de "))}" target="_blank" rel="noopener">Pedir una tarjeta regalo</a></div>`
        : ""
    }
  </section>

  <section id="cita" class="contenedor bloque" aria-labelledby="titulo-cita">
    <h2 id="titulo-cita" class="aparece">Cómo pedir cita</h2>
    ${
      api
        ? `<ol class="pasos">
      <li><span>1</span>Arriba, elige tratamiento, día y hora: se ven las horas libres al momento.</li>
      <li><span>2</span>Deja tu nombre y tu teléfono y pulsa «Reservar».</li>
      <li><span>3</span>Te confirmamos la cita por WhatsApp.</li>
    </ol>
    <div class="centrado"><a class="boton boton-principal" href="#reservar">Reservar mi cita</a></div>`
        : `<ol class="pasos">
      <li><span>1</span>Elige tu tratamiento.</li>
      <li><span>2</span>Pulsa «Pedir cita» y envíanos el mensaje por WhatsApp.</li>
      <li><span>3</span>Te respondemos con la hora y la dejamos confirmada.</li>
    </ol>
    <div class="centrado">${ctaPrincipal}</div>`
    }
  </section>
</main>

<footer class="pie">
  <div class="contenedor">
    <div class="marca-nombre">Adela María · Belleza holística</div>
    <p>${esc(d.contacto.horario)}</p>
    ${d.contacto.direccion ? `<p>${esc(d.contacto.direccion)}</p>` : ""}
    ${instagram ? `<p><a href="https://www.instagram.com/${instagram}/" target="_blank" rel="noopener">Síguenos en Instagram: @${instagram}</a></p>` : ""}
    ${telefono ? `<p><a href="tel:${telefono}">Llamar</a> · <a href="${enlaceCita()}" target="_blank" rel="noopener">WhatsApp</a></p>` : ""}
    <p class="legal">${
      api
        ? "Si reservas aquí, guardamos tu nombre y tu teléfono solo para gestionar tu cita y contactarte sobre ella; puedes pedir que los borremos cuando quieras. La página no usa cookies ni rastreo."
        : "Esta página no recoge datos personales. Si nos escribes por WhatsApp, usaremos tu nombre y teléfono solo para gestionar tu cita."
    }</p>
  </div>
</footer>
<script>${SCRIPT_MOVIMIENTO}</script>
${
  api
    ? `<script>${SCRIPT_RESERVA}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-reservar]");
  if (!a) return;
  const sel = document.getElementById("r-servicio");
  const o = [...sel.options].find((x) => x.textContent.startsWith(a.dataset.reservar));
  if (o) { sel.value = o.value; sel.dispatchEvent(new Event("change")); }
});</script>`
    : ""
}
</body>
</html>
`;
}

/** Segundos que se ve cada foto de la portada. */
const SEGUNDOS_FOTO = 6;

/** Fundido entre las fotos de la portada con un zoom lento; la animación depende de cuántas fotos haya. */
function estilosPase(n: number): string {
  if (n === 0) return "";
  const total = n * SEGUNDOS_FOTO;
  const entra = ((1.5 / total) * 100).toFixed(2);
  const sale = (((SEGUNDOS_FOTO + 1.5) / total) * 100).toFixed(2);
  return `.pase img{animation:pase ${total}s linear infinite}
@keyframes pase{0%{opacity:0;transform:scale(1.02)}${entra}%{opacity:1}${(Number(sale) - Number(entra)).toFixed(2)}%{opacity:1}${sale}%{opacity:0;transform:scale(1.14)}100%{opacity:0;transform:scale(1.14)}}
.cinta-pista{animation:cinta ${Math.max(30, n * 7)}s linear infinite}`;
}

/** Lo que aparece al bajar: se marca cuando entra en pantalla (sin librerías). */
const SCRIPT_MOVIMIENTO = `(function(){
  var el = document.querySelectorAll(".aparece");
  if (!("IntersectionObserver" in window)) { el.forEach(function(e){ e.classList.add("visible"); }); return; }
  var io = new IntersectionObserver(function(es){ es.forEach(function(x){ if (x.isIntersecting) { x.target.classList.add("visible"); io.unobserve(x.target); } }); }, { rootMargin: "0px 0px -8% 0px" });
  el.forEach(function(e){ io.observe(e); });
})();`;

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
.marca img{display:block;height:48px;width:auto}
.galeria{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,16rem),1fr));gap:.75rem;align-items:start;margin:1rem 0 2rem}
.galeria img{width:100%;height:auto;border-radius:12px;display:block}
.preparacion{list-style:none;padding:0;margin:1.5rem auto 0;max-width:40rem;display:grid;gap:1rem}
.preparacion li{background:var(--superficie);border:1px solid var(--borde);border-radius:12px;padding:1rem 1.25rem}
.preparacion strong{display:block;font-family:"Cormorant Garamond",Georgia,serif;font-size:1.3rem;color:var(--dorado-oscuro)}
.sello{display:block;width:min(240px,60vw);height:auto;margin:0 auto 1.5rem}
.portada h2{font-size:clamp(2.6rem,9vw,4rem)}
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
/* Movimiento */
.portada{position:relative;overflow:hidden}
.portada.con-fotos{min-height:clamp(15rem,40svh,26rem);padding:1.5rem 0;display:flex;align-items:center;justify-content:center;color:#fff}
.con-fotos .sello{width:min(150px,34vw);margin-bottom:.75rem}
.con-fotos h2{font-size:clamp(2rem,7.5vw,3.4rem)}
.con-fotos .entrada{font-size:1rem;margin:.5rem auto 0}
.pase{position:absolute;inset:0}
.pase img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;will-change:opacity,transform}
.portada.con-fotos::after{content:"";position:absolute;inset:0;background:linear-gradient(rgba(43,38,32,.25),rgba(43,38,32,.55))}
.portada-texto{position:relative;z-index:1}
.destacado{padding-top:2rem;text-align:center}
.destacado img{display:block;width:100%;max-width:34rem;height:auto;margin:0 auto 1rem;border-radius:1rem}
.con-fotos .sello{background:rgba(255,253,249,.9);border-radius:50%;padding:.5rem;box-shadow:0 10px 40px rgba(0,0,0,.25)}
.con-fotos h2{text-shadow:0 2px 18px rgba(0,0,0,.35)}
.con-fotos .entrada{color:#fff;text-shadow:0 1px 10px rgba(0,0,0,.45)}
.cinta{overflow:hidden;margin:0 -1rem 2rem;-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.cinta-pista{display:flex;gap:.75rem;width:max-content}
.cinta-pista img{height:14rem;width:auto;border-radius:12px;display:block}
.cinta:hover .cinta-pista{animation-play-state:paused}
@keyframes cinta{to{transform:translateX(-50%)}}
.galeria img{transition:transform .5s ease,box-shadow .5s ease}
.galeria img:hover{transform:scale(1.03);box-shadow:0 12px 30px rgba(43,38,32,.18)}
.js .aparece{opacity:0;transform:translateY(24px);transition:opacity .9s ease,transform .9s ease}
.js .aparece.visible{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.pase img{animation:none!important}.pase img:first-child{opacity:1}.cinta-pista{animation:none!important}.js .aparece{opacity:1;transform:none;transition:none}html{scroll-behavior:auto}}
@media (max-width:30rem){.lista li{padding:.85rem 1rem}.lista .boton{min-height:2.75rem;padding:0 .9rem;font-size:.95rem}}
`;
