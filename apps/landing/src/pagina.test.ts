import { BONOS, CATEGORIAS, PRODUCTOS_VENTA } from "@adela/db/datos";
import { describe, expect, it } from "vitest";
import { construirPagina, duracionTexto } from "./pagina";

const contacto = { whatsapp: "600 11 22 33", direccion: "Calle Mayor 1", horario: "De lunes a viernes, de 9:00 a 14:00", instagram: "adela_maria_bellezaholistica" };

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
    expect(conProductos).toMatch(/D-Glow - Crema facial iluminadora<\/div>\s*<div class="detalle"><strong>12,80[\s\u00a0]€<\/strong>/);
    expect(conProductos).toContain('aria-label="Reservar por WhatsApp: Agua micelar"');
    // Sin productos, no hay sección vacía.
    expect(html).not.toContain('id="productos"');
  });

  it("abre la portada con las fotos elegidas y pone el diseño de ceja debajo, con botón para reservarlo", () => {
    const trabajos = [
      { titulo: "Microblading", fotos: ["01", "02", "05", "06"].map((n) => ({ archivo: `trabajos/microblading/${n}.jpg`, alt: `Microblading ${n}` })) },
      { titulo: "Uñas", fotos: [{ archivo: "trabajos/unas/01.jpg", alt: "Uñas" }] },
    ];
    const pagina = construirPagina({
      categorias: CATEGORIAS,
      bonos: BONOS,
      contacto,
      trabajos,
      portada: ["trabajos/microblading/06.jpg", "trabajos/microblading/05.jpg"],
      destacado: { archivo: "destacados/diseno-de-ceja.jpg", alt: "La importancia del diseño de ceja", tratamiento: "Diseño y depilación de cejas" },
    });
    const portada = pagina.slice(pagina.indexOf('<div class="pase"'), pagina.indexOf("</div>", pagina.indexOf('<div class="pase"')));
    const orden = [...portada.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
    expect(orden).toEqual(["trabajos/microblading/06.jpg", "trabajos/microblading/05.jpg", "trabajos/microblading/01.jpg", "trabajos/unas/01.jpg", "trabajos/microblading/02.jpg"]);
    expect(pagina).toContain('<img src="destacados/diseno-de-ceja.jpg" alt="La importancia del diseño de ceja"');
    expect(pagina).toMatch(/aria-label="Pedir cita por WhatsApp: Diseño y depilación de cejas">Reservar mi diseño de cejas</);
    // El destacado va justo después de la portada.
    expect(pagina.indexOf('class="contenedor destacado')).toBeGreaterThan(pagina.indexOf('class="portada'));
    expect(pagina.indexOf('class="contenedor destacado')).toBeLessThan(pagina.indexOf('id="tratamientos"'));
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

  it("con el servicio de reservas, el calendario va justo después de la portada; sin él, se explica cómo pedir cita", () => {
    const con = construirPagina({ categorias: CATEGORIAS, bonos: BONOS, contacto, reservasApi: "https://reservas.ejemplo.workers.dev" });
    const main = con.slice(con.indexOf("<main"));
    expect(main.indexOf('id="reservar"')).toBeLessThan(main.indexOf('id="tratamientos"'));
    // Arriba la portada con las fotos y el logo; justo debajo, el calendario.
    expect(main.indexOf('class="portada')).toBeLessThan(main.indexOf('id="reservar"'));
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
    expect(html).toContain("De lunes a viernes, de 9:00 a 14:00");
    expect(html).toContain("Calle Mayor 1");
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
