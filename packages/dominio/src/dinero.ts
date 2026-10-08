/** Los importes se guardan siempre en céntimos enteros. */

const formato = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export function formatearEuros(centimos: number): string {
  if (!Number.isInteger(centimos)) throw new Error(`Importe no entero en céntimos: ${centimos}`);
  return formato.format(centimos / 100);
}

/** Convierte "12,50", "12.5" o "12" a céntimos. Devuelve null si no es un importe válido. */
export function eurosACentimos(texto: string): number | null {
  const limpio = texto.trim().replace(/\s|€/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const [enteros, decimales = ""] = limpio.split(".") as [string, string?];
  return Number(enteros) * 100 + Number(decimales.padEnd(2, "0"));
}
