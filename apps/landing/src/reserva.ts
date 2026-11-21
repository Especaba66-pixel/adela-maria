/**
 * Calendario de reservas de la landing: justo debajo de la portada. Habla con el servicio de reservas de Cloudflare
 * (apps/reservas), que funciona aunque el TPV esté apagado. Sin librerías ni nada de terceros: HTML, CSS y un
 * poco de JavaScript.
 */
import { TEXTO_PRIVACIDAD } from "@adela/dominio";

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Bloque HTML del calendario. Sin `api`, explica cómo pedir cita mientras tanto. `instagram` (usuario) sirve de
 * contacto si el calendario no carga (por ejemplo, dentro de la app de Instagram).
 */
export function bloqueReserva(api: string | null, alternativa: string, instagram: string | null = null): string {
  if (!api) {
    return `<section id="reservar" class="reserva" aria-labelledby="titulo-reservar">
  <div class="contenedor">
    <h2 id="titulo-reservar">Reserva tu cita</h2>
    <p class="entrada">Muy pronto podrás elegir aquí tu tratamiento, el día y la hora.</p>
    ${alternativa}
  </div>
</section>`;
  }
  return `<section id="reservar" class="reserva" aria-labelledby="titulo-reservar">
  <div class="contenedor">
    <h2 id="titulo-reservar">Reserva tu cita</h2>
    <p class="entrada">Elige tratamiento, día y hora. Te confirmamos la cita en cuanto podamos.</p>
    <div class="calendario" id="calendario" data-api="${esc(api)}">
      <label class="paso">
        <span class="paso-titulo"><span class="paso-numero">1</span>Tratamiento</span>
        <select id="r-servicio" required><option value="">Cargando tratamientos…</option></select>
      </label>
      <div class="paso" id="r-paso-dia" hidden>
        <span class="paso-titulo"><span class="paso-numero">2</span>Día</span>
        <div class="dias" id="r-dias" role="group" aria-label="Día"></div>
        <button type="button" class="enlace" id="r-mas">Ver más días</button>
      </div>
      <div class="paso" id="r-paso-hora" hidden>
        <span class="paso-titulo"><span class="paso-numero">3</span>Hora</span>
        <div class="horas" id="r-horas" role="group" aria-label="Hora"></div>
      </div>
      <form class="paso" id="r-datos" hidden novalidate>
        <span class="paso-titulo"><span class="paso-numero">4</span>Tus datos</span>
        <p class="resumen" id="r-resumen"></p>
        <label>Nombre<input name="nombre" autocomplete="name" required maxlength="80"></label>
        <label>Teléfono<input name="telefono" type="tel" autocomplete="tel" inputmode="tel" required></label>
        <label>Comentario (opcional)<textarea name="nota" rows="2" maxlength="500"></textarea></label>
        <label class="trampa" aria-hidden="true">Web<input name="web" tabindex="-1" autocomplete="off"></label>
        <label class="acepto"><input type="checkbox" name="acepta" required> <span>${esc(TEXTO_PRIVACIDAD)}</span></label>
        <button class="boton boton-principal" type="submit">Reservar</button>
      </form>
      <p class="aviso" id="r-aviso" role="alert" hidden></p>
      <div class="sin-conexion" id="r-sin-conexion" hidden>
        <p id="r-sin-conexion-texto"></p>
        <div class="sin-conexion-botones">
          <button type="button" class="boton boton-principal" id="r-copiar">Copiar enlace</button>
          ${instagram ? `<a class="boton boton-secundario" href="https://www.instagram.com/${esc(instagram)}/" target="_blank" rel="noopener">Escríbenos por Instagram</a>` : ""}
        </div>
      </div>
      <div class="hecho" id="r-hecho" role="status" hidden></div>
    </div>
    <noscript><p class="entrada">Para reservar aquí hace falta activar JavaScript.</p>${alternativa}</noscript>
  </div>
</section>`;
}

export const ESTILOS_RESERVA = `
.reserva{padding:1.25rem 0 2.5rem;background:linear-gradient(var(--fondo),var(--crema))}
.reserva h2{font-size:clamp(2.2rem,8vw,3.2rem);text-align:center}
.reserva .entrada{text-align:center;margin:.5rem auto 1.5rem}
.calendario{max-width:44rem;margin:0 auto;background:var(--superficie);border:1px solid var(--borde);border-radius:1.25rem;padding:1.25rem;display:grid;gap:1.25rem;box-shadow:0 10px 30px rgba(122,92,46,.08)}
.paso{display:grid;gap:.6rem}
.paso[hidden]{display:none}
.paso-titulo{font:600 1.35rem "Cormorant Garamond",Georgia,serif;color:var(--dorado-oscuro);display:flex;align-items:center;gap:.5rem}
.paso-numero{display:inline-flex;width:1.7rem;height:1.7rem;border-radius:50%;background:var(--dorado-oscuro);color:#fff;font:600 .95rem Inter,sans-serif;align-items:center;justify-content:center}
.calendario select,.calendario input:not([type=checkbox]),.calendario textarea{width:100%;box-sizing:border-box;min-height:3rem;border:2px solid var(--borde);border-radius:.75rem;padding:.6rem .8rem;font:inherit;background:#fff;color:var(--tinta)}
.calendario select:focus,.calendario input:focus,.calendario textarea:focus{outline:3px solid var(--dorado);outline-offset:1px}
.calendario label{display:grid;gap:.3rem}
.dias{display:grid;grid-template-columns:repeat(auto-fill,minmax(4.6rem,1fr));gap:.5rem}
.dia,.hora{min-height:3rem;border:2px solid var(--borde);border-radius:.75rem;background:#fff;font:inherit;color:var(--tinta);cursor:pointer;padding:.35rem .25rem;line-height:1.2}
.dia small{display:block;font-size:.75rem;color:var(--suave);text-transform:capitalize}
.dia:disabled,.hora:disabled{opacity:.4;cursor:not-allowed;text-decoration:line-through}
.dia[aria-pressed=true],.hora[aria-pressed=true]{background:var(--dorado-oscuro);border-color:var(--dorado-oscuro);color:#fff}
.dia[aria-pressed=true] small{color:#fff}
.horas{display:grid;grid-template-columns:repeat(auto-fill,minmax(5rem,1fr));gap:.5rem}
.enlace{background:none;border:0;color:var(--dorado-oscuro);text-decoration:underline;font:inherit;cursor:pointer;justify-self:start;padding:.25rem 0}
.resumen{margin:0;padding:.75rem 1rem;background:var(--crema);border-radius:.75rem}
.acepto{display:flex!important;grid-template-columns:none;align-items:flex-start;gap:.6rem;font-size:.9rem;color:var(--suave)}
.acepto input{width:1.4rem;height:1.4rem;flex:none;margin-top:.15rem;accent-color:var(--dorado-oscuro)}
.trampa{position:absolute!important;left:-9999px}
.aviso{margin:0;padding:.75rem 1rem;border-radius:.75rem;background:#fef3f2;color:#b42318}
.sin-conexion{padding:1rem;border-radius:1rem;background:var(--crema);text-align:center}
.sin-conexion p{margin:0 0 .75rem}
.sin-conexion-botones{display:flex;flex-wrap:wrap;gap:.6rem;justify-content:center}
.sin-conexion button.boton{border:0;cursor:pointer;font-family:inherit}
.hecho{padding:1.25rem;border-radius:1rem;background:#ecfdf3;color:#205c3a;text-align:center}
.hecho strong{display:block;font:600 1.6rem "Cormorant Garamond",serif}
`;

/** Comportamiento del calendario (se mete tal cual en la página). */
export const SCRIPT_RESERVA = `(() => {
  const raiz = document.getElementById("calendario");
  if (!raiz) return;
  const api = raiz.dataset.api.replace(/\\/+$/, "");
  const $ = (id) => document.getElementById(id);
  const selServicio = $("r-servicio"), pasoDia = $("r-paso-dia"), dias = $("r-dias"), mas = $("r-mas");
  const pasoHora = $("r-paso-hora"), horas = $("r-horas"), datos = $("r-datos"), resumen = $("r-resumen");
  const aviso = $("r-aviso"), hecho = $("r-hecho");
  const POR_TANDA = 14, MAX_DIAS = 60;
  let servicios = [], servicio = null, cargados = 0, dia = null, hora = null;
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  const sumar = (f, n) => { const d = new Date(f + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const fmt = (f, o) => new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", ...o }).format(new Date(f + "T12:00:00Z"));
  const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  const euros = (c) => c == null ? "" : c === 0 ? " · Gratis" : " · " + (c / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" }).replace(",00", "");
  const mostrarAviso = (t) => { aviso.textContent = t; aviso.hidden = !t; };
  const boton = (clase, html, alPulsar) => { const b = document.createElement("button"); b.type = "button"; b.className = clase; b.setAttribute("aria-pressed", "false"); b.innerHTML = html; b.addEventListener("click", alPulsar); return b; };
  const marcar = (cont, b) => { for (const x of cont.children) x.setAttribute("aria-pressed", String(x === b)); };

  // Navegadores de dentro de Instagram o Facebook: a veces no dejan hablar con el servicio de reservas.
  const enApp = /Instagram|FBAN|FBAV|FB_IAB/i.test(navigator.userAgent);
  function sinConexion() {
    selServicio.innerHTML = '<option value="">No disponible ahora</option>';
    $("r-sin-conexion-texto").textContent = enApp
      ? "Desde Instagram a veces no se puede reservar aquí. Toca los tres puntos (⋯) de arriba y elige «Abrir en el navegador». También puedes copiar el enlace y pegarlo en Safari o Chrome, o escribirnos por Instagram:"
      : "Ahora mismo no se puede cargar el calendario. Prueba en un momento, abre la web en otro navegador o escríbenos por Instagram:";
    $("r-sin-conexion").hidden = false;
  }
  $("r-copiar").addEventListener("click", async () => {
    const enlace = location.origin + location.pathname;
    try {
      await navigator.clipboard.writeText(enlace);
      $("r-copiar").textContent = "Enlace copiado: pégalo en Safari o Chrome";
    } catch (e) {
      window.prompt("Copia este enlace y pégalo en Safari o Chrome:", enlace);
    }
  });

  async function pedir(ruta, opciones) {
    const r = await fetch(api + ruta, opciones);
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(cuerpo.error || "No se ha podido conectar. Prueba otra vez.");
    return cuerpo;
  }

  // «Nuestros servicios» sigue al TPV: al abrir la web, cada apartado se rellena con los tratamientos que el centro
  // tiene ahora (nombre, duración, precio y botón de reservar). Lo que se quita en el TPV deja de salir, lo nuevo sale
  // (también apartados nuevos) y los precios son los del TPV. Si no se puede conectar, se queda la lista de la página.
  // Las uñas van juntas en su apartado, el primero.
  const esUnas = (s) => /u[ñn]as?\\b/i.test(s.nombre);
  const grupoDe = (s) => esUnas(s) ? "Uñas" : s.categoria === "Microblading, maquillaje y uñas" ? "Microblading y maquillaje" : s.categoria;
  const claveDe = (s) => esUnas(s) ? "Uñas" : s.categoria;
  const idCat = (t) => "cat-" + t.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const bonito = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const duracion = (m) => { const h = Math.floor(m / 60), r = m % 60; return h === 0 ? r + " min" : r === 0 ? h + " h" : h + " h " + r + " min"; };
  const precio = (c) => c == null ? "Consultar" : c === 0 ? "Gratis" : (c / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" }).replace(",00", "");
  function crearApartado(id, titulo) {
    const caja = document.createElement("details"); caja.className = "opcion"; caja.id = id;
    const resumen = document.createElement("summary");
    const nombre = document.createElement("span"); nombre.className = "opcion-nombre"; nombre.textContent = titulo;
    const desde = document.createElement("span"); desde.className = "opcion-resumen";
    resumen.append(nombre, desde);
    const cuerpo = document.createElement("div"); cuerpo.className = "opcion-cuerpo";
    const lista = document.createElement("ul"); lista.className = "lista"; cuerpo.append(lista);
    caja.append(resumen, cuerpo);
    return caja;
  }
  function filaServicio(s) {
    const li = document.createElement("li"); li.className = "tratamiento";
    const texto = document.createElement("div");
    const nombre = document.createElement("div"); nombre.className = "nombre"; nombre.textContent = bonito(s.nombre);
    const detalle = document.createElement("div"); detalle.className = "detalle"; detalle.textContent = duracion(s.duracion) + " · ";
    const p = document.createElement("strong"); p.textContent = precio(s.precio); detalle.append(p);
    texto.append(nombre, detalle);
    const boton = document.createElement("a"); boton.className = "boton boton-secundario"; boton.href = "#reservar";
    boton.dataset.reservar = s.nombre; boton.dataset.reservarId = s.id; boton.textContent = "Reservar";
    boton.setAttribute("aria-label", "Reservar: " + bonito(s.nombre));
    li.append(texto, boton);
    return li;
  }
  function mostrarServicios() {
    const contenedor = $("cat-lista");
    if (!contenedor || servicios.length === 0) return;
    const grupos = new Map();
    for (const s of servicios) {
      const clave = claveDe(s);
      if (!grupos.has(clave)) grupos.set(clave, { titulo: grupoDe(s), lista: [] });
      grupos.get(clave).lista.push(s);
    }
    const claves = [...grupos.keys()].sort((a, b) => Number(b === "Uñas") - Number(a === "Uñas"));
    const vistos = new Set();
    for (const clave of claves) {
      const { titulo, lista } = grupos.get(clave);
      const id = idCat(clave);
      vistos.add(id);
      const caja = $(id) || crearApartado(id, titulo);
      let ul = caja.querySelector("ul.lista");
      if (!ul) { ul = document.createElement("ul"); ul.className = "lista"; caja.querySelector(".opcion-cuerpo").append(ul); }
      // En uñas, de más barato a más caro y lo gratis (la retirada) al final; en lo demás, el orden del TPV.
      const orden = (s) => (s.precio === 0 ? 1e9 : s.precio ?? 1e8);
      const enOrden = clave === "Uñas" ? [...lista].sort((a, b) => orden(a) - orden(b) || a.nombre.localeCompare(b.nombre, "es")) : lista;
      ul.replaceChildren(...enOrden.map(filaServicio));
      const conPrecio = lista.map((s) => s.precio).filter((c) => c > 0);
      caja.querySelector(".opcion-resumen").textContent = conPrecio.length ? "desde " + precio(Math.min(...conPrecio)) : "";
      caja.hidden = false;
      contenedor.append(caja);
    }
    for (const caja of contenedor.querySelectorAll("details.opcion")) if (!vistos.has(caja.id)) caja.hidden = true;
  }

  async function cargarServicios() {
    try {
      // Un reintento: una conexión floja del móvil no debe dejar a nadie sin reservar.
      servicios = (await pedir("/api/servicios").catch(() => new Promise((ok) => setTimeout(ok, 1500)).then(() => pedir("/api/servicios")))).servicios;
      selServicio.innerHTML = '<option value="">Elige un tratamiento</option>';
      const grupos = new Map();
      for (const s of servicios) {
        const grupo = grupoDe(s);
        if (!grupos.has(grupo)) { const g = document.createElement("optgroup"); g.label = grupo; grupos.set(grupo, g); selServicio.append(g); }
        const o = document.createElement("option"); o.value = s.id; o.textContent = bonito(s.nombre) + euros(s.precio); grupos.get(grupo).append(o);
      }
      mostrarServicios();
    } catch (e) {
      sinConexion();
    }
  }

  async function cargarDias() {
    const desde = sumar(hoy, cargados);
    const n = Math.min(POR_TANDA, MAX_DIAS + 1 - cargados);
    if (n <= 0) return;
    mas.disabled = true;
    try {
      const { dias: lista } = await pedir("/api/disponibilidad?" + new URLSearchParams({ servicio: servicio.id, desde, dias: String(n) }));
      for (const d of lista) {
        const libre = d.horas.length > 0;
        const b = boton("dia", "<small>" + fmt(d.fecha, { weekday: "short" }) + "</small>" + fmt(d.fecha, { day: "numeric", month: "short" }), () => elegirDia(d, b));
        b.disabled = !libre;
        b.setAttribute("aria-label", fmt(d.fecha, { weekday: "long", day: "numeric", month: "long" }) + (libre ? "" : ", completo o cerrado"));
        dias.append(b);
      }
      cargados += n;
      mostrarAviso("");
    } catch (e) { mostrarAviso(e.message); }
    mas.disabled = false;
    mas.hidden = cargados > MAX_DIAS;
  }

  function elegirDia(d, b) {
    dia = d.fecha; hora = null;
    marcar(dias, b);
    horas.replaceChildren(...d.horas.map((m) => { const h = boton("hora", hhmm(m), () => elegirHora(m, h)); h.setAttribute("aria-label", hhmm(m)); return h; }));
    pasoHora.hidden = false; datos.hidden = true;
    pasoHora.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function elegirHora(m, h) {
    hora = m;
    marcar(horas, h);
    resumen.textContent = servicio.nombre + " · " + fmt(dia, { weekday: "long", day: "numeric", month: "long" }) + " a las " + hhmm(m);
    datos.hidden = false;
    datos.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  selServicio.addEventListener("change", () => {
    servicio = servicios.find((s) => s.id === selServicio.value) || null;
    dias.replaceChildren(); horas.replaceChildren(); cargados = 0; dia = null; hora = null;
    pasoHora.hidden = true; datos.hidden = true; pasoDia.hidden = !servicio;
    if (servicio) cargarDias();
  });
  mas.addEventListener("click", cargarDias);

  datos.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = new FormData(datos);
    const enviar = datos.querySelector("button[type=submit]");
    enviar.disabled = true; enviar.textContent = "Reservando…";
    try {
      await pedir("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servicio: servicio.id, fecha: dia, minutos: hora, nombre: f.get("nombre"), telefono: f.get("telefono"), nota: f.get("nota"), acepta: f.get("acepta") === "on", web: f.get("web") }),
      });
      for (const p of [selServicio.closest(".paso"), pasoDia, pasoHora, datos]) p.hidden = true;
      mostrarAviso("");
      hecho.innerHTML = "<strong>¡Reserva recibida!</strong>";
      hecho.append(resumen.textContent + ". Te confirmamos la cita en cuanto podamos.");
      hecho.hidden = false;
      document.getElementById("reservar").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      mostrarAviso(e.message);
      if (/ocuparse/.test(e.message)) { const d = dia; dias.replaceChildren(); cargados = 0; pasoHora.hidden = true; datos.hidden = true; await cargarDias(); dia = d; }
    }
    enviar.disabled = false; enviar.textContent = "Reservar";
  });

  cargarServicios();
})();`;
