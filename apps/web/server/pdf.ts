import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * PDF sencillo de tablas (A4 apaisado) para la asesoría: título, secciones con cabecera de columnas que se repite al
 * cambiar de página, filas de totales en negrita y «Página X de Y» al pie. Solo tipos de letra estándar (sin archivos).
 */

export interface Columna {
  titulo: string;
  /** Ancho relativo respecto a las demás columnas de la sección. */
  ancho: number;
  derecha?: boolean;
}

export interface Fila {
  celdas: string[];
  /** Fila de totales: en negrita y con fondo. */
  total?: boolean;
}

export interface Seccion {
  titulo: string;
  columnas: Columna[];
  filas: Fila[];
  /** Texto que sale si no hay filas. */
  vacio?: string;
  /** Aclaración debajo de la tabla. */
  nota?: string;
}

export interface Documento {
  titulo: string;
  subtitulo: string;
  emisor: string;
  secciones: Seccion[];
}

const ANCHO = 842;
const ALTO = 595;
const MARGEN = 36;
const UTIL = ANCHO - 2 * MARGEN;
const PIE = 30;
const TAM = 8.5;
const FILA = 13;
const TINTA = rgb(0.11, 0.11, 0.1);
const SUAVE = rgb(0.42, 0.4, 0.37);
const FONDO = rgb(0.95, 0.92, 0.87);
const LINEA = rgb(0.85, 0.81, 0.75);

/** Los tipos estándar solo saben escribir el juego de letras de Windows: lo demás se cambia por «?». */
function limpiador(fuente: PDFFont) {
  const cache = new Map<string, string>();
  return (texto: string) => {
    let salida = "";
    for (const c of texto.replace(/[  ]/g, " ")) {
      let ok = cache.get(c);
      if (ok === undefined) {
        try {
          fuente.encodeText(c);
          ok = c;
        } catch {
          ok = "?";
        }
        cache.set(c, ok);
      }
      salida += ok;
    }
    return salida;
  };
}

export async function crearPdf(d: Documento): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${d.titulo} · ${d.subtitulo}`);
  pdf.setAuthor(d.emisor);
  pdf.setCreator("Adela María · gestión");
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const limpiar = { normal: limpiador(normal), negrita: limpiador(negrita) };

  let pagina: PDFPage = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;

  const texto = (t: string, x: number, alto: number, tam: number, fuente: PDFFont, color = TINTA) =>
    pagina.drawText((fuente === negrita ? limpiar.negrita : limpiar.normal)(t), { x, y: alto, size: tam, font: fuente, color });

  /** Recorta el texto para que quepa en el ancho (con «…» al final). */
  const ajustar = (t: string, ancho: number, fuente: PDFFont, tam: number) => {
    let s = (fuente === negrita ? limpiar.negrita : limpiar.normal)(t);
    if (fuente.widthOfTextAtSize(s, tam) <= ancho) return s;
    while (s.length > 1 && fuente.widthOfTextAtSize(s + "…", tam) > ancho) s = s.slice(0, -1);
    return s + "…";
  };

  // Cabecera del documento (solo en la primera página).
  texto(d.titulo, MARGEN, y - 16, 16, negrita);
  y -= 32;
  texto(d.subtitulo, MARGEN, y, 10, normal);
  y -= 14;
  texto(d.emisor, MARGEN, y, 9, normal, SUAVE);
  y -= 22;

  const nuevaPagina = () => {
    pagina = pdf.addPage([ANCHO, ALTO]);
    y = ALTO - MARGEN;
  };
  const queda = (alto: number) => y - alto >= MARGEN + PIE;

  for (const s of d.secciones) {
    const total = s.columnas.reduce((a, c) => a + c.ancho, 0);
    const anchos = s.columnas.map((c) => (c.ancho / total) * UTIL);
    const xs = anchos.map((_, i) => MARGEN + anchos.slice(0, i).reduce((a, b) => a + b, 0));

    const celdas = (valores: string[], fuente: PDFFont, color = TINTA) => {
      valores.forEach((v, i) => {
        const col = s.columnas[i];
        if (!col || !v) return;
        const t = ajustar(v, anchos[i]! - 6, fuente, TAM);
        const x = col.derecha ? xs[i]! + anchos[i]! - 3 - fuente.widthOfTextAtSize(t, TAM) : xs[i]! + 3;
        pagina.drawText(t, { x, y: y - 9.5, size: TAM, font: fuente, color });
      });
    };
    const titulo = (continua: boolean) => {
      texto(continua ? `${s.titulo} (continúa)` : s.titulo, MARGEN, y - 11, 11, negrita);
      y -= 18;
    };
    const cabecera = () => {
      pagina.drawRectangle({ x: MARGEN, y: y - FILA, width: UTIL, height: FILA, color: FONDO });
      celdas(
        s.columnas.map((c) => c.titulo),
        negrita,
        SUAVE,
      );
      y -= FILA;
    };

    // Que el título no se quede solo al final de una página.
    if (!queda(18 + FILA * 3)) nuevaPagina();
    titulo(false);
    if (s.filas.length === 0) {
      texto(s.vacio ?? "Nada en este periodo.", MARGEN, y - 9, 9, normal, SUAVE);
      y -= 16;
    } else {
      cabecera();
      for (const f of s.filas) {
        if (!queda(FILA)) {
          nuevaPagina();
          titulo(true);
          cabecera();
        }
        if (f.total) pagina.drawRectangle({ x: MARGEN, y: y - FILA, width: UTIL, height: FILA, color: FONDO });
        celdas(f.celdas, f.total ? negrita : normal);
        pagina.drawLine({ start: { x: MARGEN, y: y - FILA }, end: { x: MARGEN + UTIL, y: y - FILA }, thickness: 0.4, color: LINEA });
        y -= FILA;
      }
    }
    if (s.nota) {
      if (!queda(14)) nuevaPagina();
      texto(s.nota, MARGEN, y - 10, 8, normal, SUAVE);
      y -= 14;
    }
    y -= 14;
  }

  const paginas = pdf.getPages();
  paginas.forEach((p, i) => {
    const pie = limpiar.normal(`${d.emisor} · ${d.titulo} · ${d.subtitulo}`);
    p.drawText(pie, { x: MARGEN, y: MARGEN - 12, size: 7.5, font: normal, color: SUAVE });
    const num = `Página ${i + 1} de ${paginas.length}`;
    p.drawText(num, { x: ANCHO - MARGEN - normal.widthOfTextAtSize(num, 7.5), y: MARGEN - 12, size: 7.5, font: normal, color: SUAVE });
  });
  return pdf.save();
}
