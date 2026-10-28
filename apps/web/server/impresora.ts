import "server-only";
/**
 * Impresora de tickets y cajón. La app funciona en el propio TPV, así que el servidor habla directamente con la
 * impresora. Tipos:
 *   - ninguna: no imprime (el ticket se ve en pantalla y se puede enviar por WhatsApp).
 *   - simulador: guarda cada ticket como archivo de texto (para probar sin impresora).
 *   - red: impresora con cable de red o wifi, ESC/POS por el puerto 9100.
 *   - windows: impresora instalada en Windows (USB), por su nombre (o el de compartirla), enviando los datos en bruto.
 * El cajón va conectado a la impresora y se abre con un comando ESC/POS, o bien directamente al TPV por USB: entonces
 * Windows lo ve como un puerto COM («USB Serial Port (COM3)») y se abre mandándole ese mismo comando.
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
  /** Puerto COM del cajón cuando va enchufado al TPV por USB (por ejemplo «COM3»). Sin él, el cajón va a la impresora. */
  cajonCom?: string;
}

export const PUERTO_COM = /^COM\d{1,3}$/i;

/** Abre el cajón conectado por USB (puerto COM): le manda el comando de apertura a 9600 baudios. */
async function abrirCajonCom(puerto: string): Promise<void> {
  if (!PUERTO_COM.test(puerto)) throw new Error("Puerto del cajón no válido.");
  if (process.platform !== "win32") throw new Error("El cajón por puerto COM solo funciona en el TPV (Windows).");
  const bytes = Array.from(ABRIR_CAJON).join(",");
  const orden = `$p = New-Object System.IO.Ports.SerialPort '${puerto.toUpperCase()}', 9600; $p.Open(); $p.Write([byte[]](${bytes}), 0, ${ABRIR_CAJON.length}); Start-Sleep -Milliseconds 200; $p.Close()`;
  await promisify(execFile)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", orden], { windowsHide: true, timeout: 10_000 });
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

/**
 * Envía los bytes en bruto a una impresora instalada en Windows, por su nombre (la API de impresión de Windows,
 * «winspool»), sin necesidad de compartirla. Si no funciona así, prueba por el recurso compartido (\\localhost\nombre).
 */
async function enviarAWindows(nombre: string, datos: Uint8Array): Promise<void> {
  if (!/^[\w .()-]{1,64}$/.test(nombre)) throw new Error("Nombre de impresora no válido.");
  const archivo = join(tmpdir(), `ticket-${Date.now()}.bin`);
  await writeFile(archivo, datos);
  const script = `
$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public static class Crudo {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] public class Doc { public string Nombre; public string Archivo; public string Tipo; }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] public static extern int StartDocPrinter(IntPtr h, int nivel, [In] Doc d);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool WritePrinter(IntPtr h, byte[] b, int n, out int escritos);
  public static void Enviar(string impresora, byte[] bytes) {
    IntPtr h; if (!OpenPrinter(impresora, out h, IntPtr.Zero)) throw new Exception("No encuentro la impresora «" + impresora + "» en Windows.");
    try {
      if (StartDocPrinter(h, 1, new Doc { Nombre = "Ticket", Tipo = "RAW" }) == 0) throw new Exception("La impresora no acepta el ticket.");
      StartPagePrinter(h); int n; WritePrinter(h, bytes, bytes.Length, out n); EndPagePrinter(h); EndDocPrinter(h);
      if (n != bytes.Length) throw new Exception("La impresora no ha recibido el ticket entero.");
    } finally { ClosePrinter(h); }
  }
}
"@
$nombre = $env:ADELA_IMPRESORA
$impresora = Get-Printer | Where-Object { $_.Name -eq $nombre -or $_.ShareName -eq $nombre } | Select-Object -First 1
[Crudo]::Enviar($(if ($impresora) { $impresora.Name } else { $nombre }), [IO.File]::ReadAllBytes($env:ADELA_TICKET))
`;
  try {
    await promisify(execFile)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true,
      timeout: 20_000,
      env: { ...process.env, ADELA_IMPRESORA: nombre, ADELA_TICKET: archivo },
    });
  } catch (directo) {
    try {
      await promisify(execFile)("cmd", ["/c", "copy", "/b", archivo, `\\\\localhost\\${nombre}`], { windowsHide: true, timeout: 10_000 });
    } catch {
      const motivo = String((directo as { stderr?: string }).stderr ?? (directo as Error).message).split("\n").find((l) => l.includes("impresora")) ?? "";
      throw new Error(motivo.trim() || `No encuentro la impresora «${nombre}» en Windows.`);
    }
  }
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
  const c = await configImpresora();
  if (!c.cajonCom) {
    const texto = lineas.join("\n") + (abrirCajon ? "\n[Abrir cajón]" : "");
    return enviar(bytesTicket(lineas, { abrirCajon }), texto, c);
  }
  // Cajón por USB: el ticket va a la impresora (si hay) y el cajón se abre aparte.
  const ticket = await enviar(bytesTicket(lineas, { abrirCajon: false }), lineas.join("\n"), c);
  if (!abrirCajon) return ticket;
  const caja = await abrirCajonDe(c);
  if (!caja.ok) return ticket.ok ? caja : { ok: false, error: `${ticket.error} ${caja.error}` };
  return ticket;
}

async function abrirCajonDe(c: ConfigImpresora): Promise<ResultadoImpresion> {
  if (!c.cajonCom) return enviar(Uint8Array.from(ABRIR_CAJON), "[Abrir cajón]", c);
  try {
    await abrirCajonCom(c.cajonCom);
    return { ok: true, detalle: "Cajón abierto." };
  } catch (e) {
    return { ok: false, error: `No se pudo abrir el cajón: ${(e as Error).message}` };
  }
}

export async function abrirCajon(): Promise<ResultadoImpresion> {
  return abrirCajonDe(await configImpresora());
}
