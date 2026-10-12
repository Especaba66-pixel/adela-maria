import "server-only";
/**
 * Impresora de tickets y cajón. La app funciona en el propio TPV, así que el servidor habla directamente con la
 * impresora. Tipos:
 *   - ninguna: no imprime (el ticket se ve en pantalla y se puede enviar por WhatsApp).
 *   - simulador: guarda cada ticket como archivo de texto (para probar sin impresora).
 *   - red: impresora con cable de red o wifi, ESC/POS por el puerto 9100.
 *   - windows: impresora instalada en Windows (USB), enviando los datos en bruto con «copy /b».
 * El cajón va conectado a la impresora y se abre con un comando ESC/POS.
 */
import { centro } from "@adela/db";
import { ABRIR_CAJON, bytesTicket } from "@adela/dominio";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { db } from "./db";

export interface ConfigImpresora {
  tipo: "ninguna" | "simulador" | "red" | "windows";
  host?: string;
  puerto?: number;
  /** Nombre de la impresora compartida en Windows. */
  nombre?: string;
  /** Caracteres por línea: 48 (papel de 80 mm) o 32 (58 mm). */
  ancho?: 32 | 48;
}

export const CARPETA_SIMULADOR = process.env.IMPRESORA_SIMULADA ?? join(tmpdir(), "adela-tickets");

export async function configImpresora(): Promise<ConfigImpresora> {
  const [c] = await db().select({ impresora: centro.impresora }).from(centro).limit(1);
  return (c?.impresora as ConfigImpresora | null) ?? { tipo: "ninguna" };
}

function enviarPorRed(host: string, puerto: number, datos: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = new Socket();
    s.setTimeout(5000);
    s.once("timeout", () => (s.destroy(), reject(new Error("La impresora no responde."))));
    s.once("error", (e) => reject(e));
    s.connect(puerto, host, () => s.end(Buffer.from(datos), () => resolve()));
  });
}

async function enviarAWindows(nombre: string, datos: Uint8Array): Promise<void> {
  if (!/^[\w .()-]{1,64}$/.test(nombre)) throw new Error("Nombre de impresora no válido.");
  const archivo = join(tmpdir(), `ticket-${Date.now()}.bin`);
  await writeFile(archivo, datos);
  await promisify(execFile)("cmd", ["/c", "copy", "/b", archivo, `\\\\localhost\\${nombre}`], { windowsHide: true, timeout: 10_000 });
}

export type ResultadoImpresion = { ok: true; detalle: string } | { ok: false; error: string };

/** Manda bytes a la impresora configurada. Nunca lanza: si falla, la venta ya está guardada y se puede reimprimir. */
export async function enviar(datos: Uint8Array, textoParaSimulador: string, config?: ConfigImpresora): Promise<ResultadoImpresion> {
  const c = config ?? (await configImpresora());
  try {
    switch (c.tipo) {
      case "ninguna":
        return { ok: true, detalle: "Sin impresora configurada." };
      case "simulador": {
        await mkdir(CARPETA_SIMULADOR, { recursive: true });
        const archivo = join(CARPETA_SIMULADOR, `ticket-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`);
        await writeFile(archivo, textoParaSimulador, "utf8");
        return { ok: true, detalle: `Simulado: ${archivo}` };
      }
      case "red":
        if (!c.host) return { ok: false, error: "Falta la dirección de la impresora." };
        await enviarPorRed(c.host, c.puerto ?? 9100, datos);
        return { ok: true, detalle: "Impreso." };
      case "windows":
        if (!c.nombre) return { ok: false, error: "Falta el nombre de la impresora." };
        await enviarAWindows(c.nombre, datos);
        return { ok: true, detalle: "Impreso." };
    }
  } catch (e) {
    return { ok: false, error: `No se pudo imprimir: ${(e as Error).message}` };
  }
}

export async function imprimirTicket(lineas: string[], abrirCajon: boolean): Promise<ResultadoImpresion> {
  const texto = lineas.join("\n") + (abrirCajon ? "\n[Abrir cajón]" : "");
  return enviar(bytesTicket(lineas, { abrirCajon }), texto);
}

export async function abrirCajon(): Promise<ResultadoImpresion> {
  return enviar(Uint8Array.from(ABRIR_CAJON), "[Abrir cajón]");
}
