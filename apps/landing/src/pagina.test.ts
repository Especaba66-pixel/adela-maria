import { BONOS, CATEGORIAS, PRODUCTOS_VENTA } from "@adela/db/datos";
import { describe, expect, it } from "vitest";
import { construirPagina, duracionTexto } from "./pagina";

const contacto = { whatsapp: "600 11 22 33", direccion: "Calle Mayor 1", horario: ["Lunes: descanso", "Martes: de 9:15 a 13:45"], instagram: "adela_maria_bellezaholistica" };

describe("landing", () => {
  const html = construirPagina({ categorias: CATEGORIAS, bonos: BONOS, contacto });

  it("muestra todos los tratamientos de las tarifas con su precio", () => {
    for (const c of CATEGORIAS) {
      for (const t of c.tratamientos) {
        expect(html).toContain(t.nombre);
      }
    }
    expect(html).toContain("Verse limpia y purificada (higiene facial)");
    expect(html).toContain("1 h 30 min · <strong>30 €</strong>");
    expect(html).toContain("5 min · <strong>3 €</strong>");
    expect(html).toContain("¿Qué necesita tu piel?");
  });

  it("muestra los productos por grupos con su precio, y un botón para reservarlos por WhatsApp", () => {
    const conProductos = construirPagina({ categorias: CATEGORIAS, bonos: BONOS, productos: PRODUCTOS_VENTA, contacto });
    expect(conProductos).toContain('id="productos"');
    for (const p of PRODUCTOS_VENTA) expect(conProductos).toContain(p.nombre);
    expect(conProductos).toContain('<h3 id="prod-serums-y-extractos">Sérums y extractos</h3>');
    expect(conProductos).toMatch(/D-Glow - Crema facial iluminadora<\/div>\s*<div class="detalle"><strong>16[\s\u00a0]€<\/strong>/);
    expect(conProductos).toContain('aria-label="Reservar por WhatsApp: Agua micelar"');
    // Sin productos, no hay sección vacía.
    expect(html).not.toContain('id="productos"');
  });

  it("muestra los bonos y que no caducan", () => {
    expect(html).toContain("Bono facial 3 sesiones");
    expect(html).toContain("240 €");
    expect(html).toContain("No caducan.");
  });

  it("enlaza a su Instagram (sin cargar nada de Instagram)", () => {
    expect(html).toContain('href="https://www.instagram.com/adela_maria_bellezaholistica/"');
    expect(html).not.toMatch(/<(script|img|iframe)[^>]+instagram/);
  });

  it("lleva el logo del centro, servido desde la propia página", () => {
    expect(html).toContain('src="logotipo.png" alt="Adela María · Belleza holística"');
    expect(html).toContain('src="sello.png"');
    expect(html).toContain('rel="icon" type="image/png" href="favicon.png"');
  });

  it("galería de trabajos solo si hay fotos, con texto alternativo", () => {
    expect(html).not.toContain('id="trabajos"');
    const con = construirPagina({ categorias: CATEGORIAS, bonos: BONOS, contacto, trabajos: [{ titulo: "Uñas", fotos: [{ archivo: "trabajos/unas/1.jpg", alt: "Uñas: trabajo 1" }] }, { titulo: "Maquillaje", fotos: [] }] });
    expect(con).toContain('<img src="trabajos/unas/1.jpg" alt="Uñas: trabajo 1" loading="lazy"');
    expect(con).not.toContain(">Maquillaje</h3>");
  });

  it("consejos para preparar la piel antes del maquillaje", () => {
    expect(html).toContain("Prepara tu piel para un maquillaje perfecto");
    expect(html).toContain("El día D");
  });

  it("arriba el lema; el menú de servicios con sus precios y, después, el calendario; sin él, se explica cómo pedir cita", () => {
    const con = construirPagina({ categorias: CATEGORIAS, bonos: BONOS, contacto, reservasApi: "https://reservas.ejemplo.workers.dev" });
    const main = con.slice(con.indexOf("<main"));
    expect(main).toContain("<h1>Cuidamos de ti</h1>");
    expect(main).toContain("Adela María, experta en el cuidado de tu imagen");
    // La portada, el menú de servicios (a la izquierda en pantallas grandes) y el calendario, en ese orden.
    expect(main.indexOf('class="portada')).toBeLessThan(main.indexOf('id="tratamientos"'));
    expect(main.indexOf('id="tratamientos"')).toBeLessThan(main.indexOf('id="reservar"'));
    // Cada opción se abre para ver sus tratamientos, con el precio desde el que empieza.
    expect(main).toMatch(/<details class="opcion" id="cat-depilacion">\s*<summary><span class="opcion-nombre">Depilación<\/span><span class="opcion-resumen">desde 3[\s\u00a0]€<\/span>/);
    expect(main).toMatch(/<span class="opcion-nombre">Microblading, maquillaje y uñas<\/span><span class="opcion-resumen">desde 30[\s\u00a0]€<\/span>/);
    // Lo que aún no tiene precio, a consultar.
    expect(main).toMatch(/<div class="nombre">Uñas<\/div>\s*<div class="detalle"><strong>Consultar<\/strong>/);
    expect(main).toContain('<details class="opcion" id="bonos">');
    expect(main).toContain('<details class="opcion" id="regalo">');
    expect(con).toContain('data-api="https://reservas.ejemplo.workers.dev"');
    expect(con).toContain('data-reservar="Axilas"');
    expect(con).toContain("Si reservas aquí, guardamos tu nombre y tu teléfono");
    expect(html).toContain("Muy pronto podrás elegir aquí tu tratamiento");
    // Sin servicio de reservas no va el código del calendario (solo el pequeño del movimiento).
    expect(html).not.toContain("r-servicio");
    expect(construirPagina({ categorias: CATEGORIAS, bonos: BONOS, contacto, reservasApi: 'javascript:alert(1)"' })).not.toContain("data-api");
  });

  it("ofrece tarjetas regalo por WhatsApp", () => {
    expect(html).toContain("Tarjeta regalo");
    expect(html).toContain(`href="https://wa.me/34600112233?text=${encodeURIComponent("Hola, me gustaría una tarjeta regalo de ")}"`);
  });

  it("cada tratamiento tiene su botón de WhatsApp con el mensaje escrito", () => {
    expect(html).toContain(
      `href="https://wa.me/34600112233?text=${encodeURIComponent("Hola, me gustaría pedir cita para «Axilas». ")}"`,
    );
    expect(html).toContain('aria-label="Pedir cita por WhatsApp: Axilas"');
    expect(html).toContain('<ul class="horario" aria-label="Horario"><li>Lunes: descanso</li><li>Martes: de 9:15 a 13:45</li></ul>');
    expect(html).toContain("Calle Mayor 1");
    // El teléfono, a la vista arriba y en el pie, para llamar con un toque.
    expect(html).toContain('<a class="telefono" href="tel:+34600112233" aria-label="Llamar al 600 11 22 33">');
    expect(html).toContain('Teléfono y WhatsApp: <a href="tel:+34600112233">600 11 22 33</a>');
    expect(html).toContain('o llámanos al <a href="tel:+34600112233">600 11 22 33</a>');
  });

  it("sin WhatsApp no muestra botones rotos", () => {
    const sin = construirPagina({ categorias: CATEGORIAS, bonos: BONOS, contacto: { ...contacto, whatsapp: null } });
    expect(sin).not.toContain("wa.me");
    expect(sin).toContain("Muy pronto podrás pedir cita");
  });

  it("rechaza un WhatsApp mal escrito y escapa el texto", () => {
    expect(() => construirPagina({ categorias: CATEGORIAS, bonos: BONOS, contacto: { ...contacto, whatsapp: "123" } })).toThrow();
    const raro = construirPagina({ categorias: [{ nombre: "X", tratamientos: [{ nombre: "<b>A & B</b>", duracionMinutos: 5, precioCentimos: 100 }] }], bonos: [], contacto });
    expect(raro).toContain("&lt;b&gt;A &amp; B&lt;/b&gt;");
    expect(raro).not.toContain("<b>A & B</b>");
  });

  it("las fotos de los trabajos se mueven en la portada y en la cinta, y se respeta «reducir movimiento»", () => {
    const con = construirPagina({ categorias: CATEGORIAS, bonos: BONOS, contacto, trabajos: [{ titulo: "Uñas", fotos: [{ archivo: "trabajos/unas/1.jpg", alt: "Uñas: trabajo 1" }, { archivo: "trabajos/unas/2.jpg", alt: "Uñas: trabajo 2" }] }] });
    expect(con).toContain('class="portada con-fotos"');
    expect(con).toContain('style="animation-delay:6s"');
    expect(con.match(/<div class="cinta-pista">.*?<\/div>/s)![0].match(/<img/g)).toHaveLength(4);
    expect(con).toContain("@keyframes pase");
    expect(con).toContain("prefers-reduced-motion:reduce");
    expect(html).not.toContain('class="portada con-fotos"');
  });

  it("con fotos propias de portada, el fondo lleva solo esas y los trabajos se quedan en su sección", () => {
    const trabajos = [{ titulo: "Uñas", fotos: [{ archivo: "trabajos/unas/1.jpg", alt: "Uñas: trabajo 1" }] }];
    const con = construirPagina({ categorias: CATEGORIAS, bonos: BONOS, contacto, trabajos, portada: [{ archivo: "portada/01.jpg" }, { archivo: "portada/02.jpg" }] });
    const pase = con.match(/<div class="pase".*?<\/div>/s)![0];
    expect([...pase.matchAll(/src="([^"]+)"/g)].map((m) => m[1])).toEqual(["portada/01.jpg", "portada/02.jpg"]);
    const cinta = con.match(/<div class="cinta-pista">.*?<\/div>/s)![0];
    expect(cinta).toContain("trabajos/unas/1.jpg");
    expect(cinta).not.toContain("portada/");
    expect(con).toContain('src="trabajos/unas/1.jpg" alt="Uñas: trabajo 1"');
  });

  it("no carga nada de terceros (ni tipografías de Google)", () => {
    expect(html).not.toMatch(/googleapis|gstatic|<script[^>]+src=/);
    expect(html).toContain("fuentes/inter-latin-400-normal.woff2");
  });

  it("duraciones legibles", () => {
    expect(duracionTexto(90)).toBe("1 h 30 min");
    expect(duracionTexto(60)).toBe("1 h");
    expect(duracionTexto(25)).toBe("25 min");
  });
});
