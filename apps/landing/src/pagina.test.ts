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
