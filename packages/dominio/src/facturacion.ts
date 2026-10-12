/**
 * Facturación: series, numeración y registro encadenado.
 *
 * Base preparada para VERI*FACTU: cada factura genera un registro con una huella SHA-256 que incluye la del
 * registro anterior, así que cualquier cambio rompe la cadena. El formato exacto de la huella y del QR de la
 * Agencia Tributaria se ajusta en la fase 8, tras leer la Orden HAC/1177/2024.
 */
import { createHash } from "node:crypto";

export const TIPOS_FACTURA = ["simplificada", "completa", "rectificativa"] as const;
export type TipoFactura = (typeof TIPOS_FACTURA)[number];

/** Una serie por tipo y año: T = tickets (simplificadas), F = completas, R = rectificativas. */
export const LETRA_SERIE: Record<TipoFactura, string> = { simplificada: "T", completa: "F", rectificativa: "R" };

export function codigoSerie(tipo: TipoFactura, anio: number): string {
  return `${LETRA_SERIE[tipo]}${anio}`;
}

/** «T2026-000123». */
export function numeroFactura(serie: string, numero: number): string {
  return `${serie}-${String(numero).padStart(6, "0")}`;
}

export interface DatosHuella {
  nifEmisor: string;
  numero: string;
  /** AAAA-MM-DD. */
  fechaExpedicion: string;
  tipo: TipoFactura | "anulacion";
  cuotaTotal: number;
  importeTotal: number;
  huellaAnterior: string | null;
  /** Momento de generación del registro, ISO 8601. */
  generadoEn: string;
}

/** Huella del registro, encadenada con la del anterior. */
export function calcularHuella(d: DatosHuella): string {
  const campos = [
    `NIF=${d.nifEmisor}`,
    `Numero=${d.numero}`,
    `Fecha=${d.fechaExpedicion}`,
    `Tipo=${d.tipo}`,
    `Cuota=${(d.cuotaTotal / 100).toFixed(2)}`,
    `Importe=${(d.importeTotal / 100).toFixed(2)}`,
    `Anterior=${d.huellaAnterior ?? ""}`,
    `Generado=${d.generadoEn}`,
  ];
  return createHash("sha256").update(campos.join("&"), "utf8").digest("hex").toUpperCase();
}

/** Recorre la cadena de registros y devuelve el primero que no cuadra, o null si está intacta. */
export function verificarCadena(registros: (DatosHuella & { huella: string })[]): number | null {
  let anterior: string | null = null;
  for (const [i, r] of registros.entries()) {
    if (r.huellaAnterior !== anterior || calcularHuella(r) !== r.huella) return i;
    anterior = r.huella;
  }
  return null;
}

/** NIF/NIE/CIF español con formato válido (sin comprobar la letra de control del CIF). */
export function validarNif(texto: string): string | null {
  const nif = texto.trim().toUpperCase().replace(/[\s-]/g, "");
  const LETRAS = "TRWAGMYFPDXBNJZSQVHLCKE";
  if (/^\d{8}[A-Z]$/.test(nif)) return LETRAS[Number(nif.slice(0, 8)) % 23] === nif[8] ? nif : null;
  if (/^[XYZ]\d{7}[A-Z]$/.test(nif)) {
    const num = Number(String("XYZ".indexOf(nif[0]!)) + nif.slice(1, 8));
    return LETRAS[num % 23] === nif[8] ? nif : null;
  }
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(nif)) return nif;
  return null;
}
