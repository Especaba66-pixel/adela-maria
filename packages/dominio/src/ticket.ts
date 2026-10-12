/**
 * Ticket para impresora térmica (ESC/POS): primero se compone como líneas de texto (sirve también para
 * enviarlo por WhatsApp o verlo en pantalla) y luego se convierte en bytes para la impresora.
 */
import { formatearEuros } from "./dinero";

export interface DatosTicket {
  emisor: { nombre: string; nombreFiscal: string; nif: string; direccion: string };
  numero: string;
  /** Texto ya formateado: «12/10/2026 10:35». */
  fechaHora: string;
  tipo: "simplificada" | "completa" | "rectificativa";
  rectificaA?: string;
  destinatario?: { nombre: string; nif: string; direccion: string };
  lineas: { descripcion: string; cantidad: number; total: number; descuentoCentesimas: number }[];
  desglose: { ivaCentesimas: number; base: number; cuota: number }[];
  total: number;
  pagos: { metodo: string; importe: number }[];
  entregado?: number;
  cambio?: number;
  atendidaPor: string;
  pie?: string;
}

const euros = (c: number) => formatearEuros(c).replace(" ", " ");

/** Recorta o rellena para que quepa en el ancho del papel. */
function fila(izquierda: string, derecha: string, ancho: number): string {
  const hueco = ancho - derecha.length - 1;
  const izq = izquierda.length > hueco ? izquierda.slice(0, hueco) : izquierda;
  return izq + " ".repeat(ancho - izq.length - derecha.length) + derecha;
}

function centrar(texto: string, ancho: number): string {
  const t = texto.slice(0, ancho);
  return " ".repeat(Math.floor((ancho - t.length) / 2)) + t;
}

function partir(texto: string, ancho: number): string[] {
  const palabras = texto.split(/\s+/);
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    if ((actual + " " + p).trim().length > ancho) {
      if (actual) lineas.push(actual);
      actual = p;
    } else actual = (actual + " " + p).trim();
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** Ticket como líneas de texto, para papel de `ancho` caracteres (32 en 58 mm, 48 en 80 mm). */
export function lineasTicket(t: DatosTicket, ancho = 48): string[] {
  const raya = "-".repeat(ancho);
  const titulo = t.tipo === "simplificada" ? "FACTURA SIMPLIFICADA" : t.tipo === "completa" ? "FACTURA" : "FACTURA RECTIFICATIVA";
  const l: string[] = [
    centrar(t.emisor.nombre, ancho),
    centrar(t.emisor.nombreFiscal, ancho),
    centrar(`NIF ${t.emisor.nif}`, ancho),
    ...partir(t.emisor.direccion, ancho).map((x) => centrar(x, ancho)),
    raya,
    titulo,
    fila(`Nº ${t.numero}`, t.fechaHora, ancho),
  ];
  if (t.rectificaA) l.push(`Rectifica a: ${t.rectificaA}`);
  if (t.destinatario) {
    l.push(raya, "Cliente:", t.destinatario.nombre, `NIF ${t.destinatario.nif}`, ...partir(t.destinatario.direccion, ancho));
  }
  l.push(raya);
  for (const x of t.lineas) {
    const desc = x.cantidad > 1 ? `${x.cantidad} x ${x.descripcion}` : x.descripcion;
    const partes = partir(desc, ancho - 12);
    l.push(fila(partes[0] ?? "", euros(x.total), ancho), ...partes.slice(1));
    if (x.descuentoCentesimas) l.push(`  dto. ${(x.descuentoCentesimas / 100).toLocaleString("es-ES")} %`);
  }
  l.push(raya, fila("TOTAL", euros(t.total), ancho), raya);
  for (const d of t.desglose) {
    const tipo = `${(d.ivaCentesimas / 100).toLocaleString("es-ES")} %`;
    l.push(fila(`Base ${tipo}`, euros(d.base), ancho), fila(`IVA ${tipo}`, euros(d.cuota), ancho));
  }
  l.push(raya);
  for (const p of t.pagos) l.push(fila(p.metodo, euros(p.importe), ancho));
  if (t.entregado !== undefined) l.push(fila("Entregado", euros(t.entregado), ancho), fila("Cambio", euros(t.cambio ?? 0), ancho));
  l.push(raya, `Le atendió: ${t.atendidaPor}`);
  if (t.pie) l.push("", ...partir(t.pie, ancho).map((x) => centrar(x, ancho)));
  return l;
}

// ── ESC/POS ──────────────────────────────────────────────────────────────────

const ESC = 0x1b;
const GS = 0x1d;

/** Caracteres españoles y € en la página de códigos PC858, la habitual en impresoras de tickets. */
const PC858: Record<string, number> = {
  "€": 0xd5, "á": 0xa0, "é": 0x82, "í": 0xa1, "ó": 0xa2, "ú": 0xa3, "ñ": 0xa4, "Ñ": 0xa5, "ü": 0x81, "Ü": 0x9a,
  "Á": 0xb5, "É": 0x90, "Í": 0xd6, "Ó": 0xe0, "Ú": 0xe9, "º": 0xa7, "ª": 0xa6, "¿": 0xa8, "¡": 0xad, "·": 0xfa,
  "«": 0xae, "»": 0xaf, "ç": 0x87, "Ç": 0x80,
};

export function codificarPc858(texto: string): number[] {
  const bytes: number[] = [];
  for (const c of texto) {
    const code = c.charCodeAt(0);
    if (code < 0x80) bytes.push(code);
    else bytes.push(PC858[c] ?? 0x3f);
  }
  return bytes;
}

/** Pulso para abrir el cajón conectado a la impresora (pin 2). */
export const ABRIR_CAJON = [ESC, 0x70, 0x00, 0x19, 0xfa];

/** Ticket listo para la impresora: inicializa, elige PC858, imprime, avanza, corta y, si se pide, abre el cajón. */
export function bytesTicket(lineas: string[], opciones: { abrirCajon?: boolean } = {}): Uint8Array {
  const b: number[] = [ESC, 0x40, ESC, 0x74, 19];
  for (const [i, linea] of lineas.entries()) {
    // La cabecera (nombre del centro) en negrita.
    if (i === 0) b.push(ESC, 0x45, 1);
    b.push(...codificarPc858(linea), 0x0a);
    if (i === 0) b.push(ESC, 0x45, 0);
  }
  b.push(0x0a, 0x0a, 0x0a, GS, 0x56, 0x42, 0x00);
  if (opciones.abrirCajon) b.push(...ABRIR_CAJON);
  return Uint8Array.from(b);
}
