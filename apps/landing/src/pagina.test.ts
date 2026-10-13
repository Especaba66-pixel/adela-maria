import { BONOS, CATEGORIAS } from "@adela/db/datos";
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

  it("con el servicio de reservas, lo primero es el calendario; sin él, se explica cómo pedir cita", () => {
    const con = construirPagina({ categorias: CATEGORIAS, bonos: BONOS, contacto, reservasApi: "https://reservas.ejemplo.workers.dev" });
    const main = con.slice(con.indexOf("<main"));
    expect(main.indexOf('id="reservar"')).toBeLessThan(main.indexOf('id="tratamientos"'));
    expect(main.indexOf('id="reservar"')).toBeLessThan(main.indexOf('class="portada"'));
    expect(con).toContain('data-api="https://reservas.ejemplo.workers.dev"');
    expect(con).toContain('data-reservar="Axilas"');
    expect(con).toContain("Si reservas aquí, guardamos tu nombre y tu teléfono");
    expect(html).toContain("Muy pronto podrás elegir aquí tu tratamiento");
    expect(html).not.toContain("<script>");
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

  it("no carga nada de terceros (ni tipografías de Google)", () => {
    expect(html).not.toMatch(/googleapis|gstatic|<script/);
    expect(html).toContain("fuentes/inter-latin-400-normal.woff2");
  });

  it("duraciones legibles", () => {
    expect(duracionTexto(90)).toBe("1 h 30 min");
    expect(duracionTexto(60)).toBe("1 h");
    expect(duracionTexto(25)).toBe("25 min");
  });
});
